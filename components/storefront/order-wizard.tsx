"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Info,
  MapPin,
  MessageSquare,
  Minus,
  Phone,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  User,
} from "lucide-react";

import { getAvailablePaymentMethods, getPaymentMethodLabel } from "@/components/dashboard/payment-helpers";
import { debugError } from "@/lib/debug";
import { fetchStorefrontLocalDeliveryQuote } from "@/lib/local-delivery/api";
import { createStorefrontOrderViaApi } from "@/lib/orders/api";
import { isValidWhatsAppPhone } from "@/lib/whatsapp";
import {
  calculateOrderProductsSubtotal,
  getOrderDisplayCode,
  type DeliveryType,
  type Order,
  type OrderProduct,
  type PaymentMethod,
} from "@/types/orders";
import type { LocalDeliveryQuote, StorefrontLocalDeliveryConfig } from "@/types/local-delivery";
import type { BusinessConfig, BusinessProduct } from "@/types/storefront";

const DEFAULT_BUSINESS_TAGLINE = "Compra rapido y confirma sin vueltas.";
const STOREFRONT_HEADER_BENEFITS = [
  {
    icon: Clock3,
    copy: "Compra rapida y simple",
  },
  {
    icon: MessageSquare,
    copy: "Respuesta rapida por WhatsApp",
  },
  {
    icon: Truck,
    copy: "Pago y entrega claros",
  },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function slugifyChoice(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.matches("input, select, textarea, [contenteditable='true']") ||
      target.closest("input, select, textarea, [contenteditable='true']"),
  );
}

function countProducts(items: Record<string, number>) {
  return Object.values(items).reduce((sum, quantity) => sum + quantity, 0);
}

function selectedProducts(
  business: BusinessConfig,
  quantities: Record<string, number>,
): OrderProduct[] {
  return business.products
    .filter((product) => (quantities[product.productId] ?? 0) > 0)
    .map((product) => ({
      productId: product.productId,
      name: product.name,
      quantity: quantities[product.productId],
      unitPrice: product.price,
    }));
}

function matchProduct(product: BusinessProduct, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || `${product.name} ${product.description}`.toLowerCase().includes(normalized);
}

function getProductInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "PD";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function resolveStorefrontSubline(tagline: string) {
  const normalizedTagline = tagline.trim();

  if (normalizedTagline.length === 0 || normalizedTagline === DEFAULT_BUSINESS_TAGLINE) {
    return "Compra rapido y te confirmamos por WhatsApp.";
  }

  return normalizedTagline;
}

function deliveryTitle(type: DeliveryType) {
  return type === "domicilio" ? "Domicilio" : "Recoger en tienda";
}

function deliveryDescription(type: DeliveryType) {
  return type === "domicilio"
    ? "Recibelo en tu direccion con coordinacion por WhatsApp."
    : "Retira directo en el negocio sin pasos extra.";
}

function deliverySupport(type: DeliveryType) {
  return type === "domicilio"
    ? "Valor final calculado segun el barrio."
    : "Sin costo adicional.";
}

function deliveryBadge(type: DeliveryType) {
  return type === "domicilio" ? "Comodidad" : "Mas rapido";
}

function getLocalDeliveryConfigMessage(localDelivery: StorefrontLocalDeliveryConfig) {
  if (localDelivery.status === "disabled") {
    return "Este negocio no tiene domicilio local habilitado en este momento.";
  }

  if (localDelivery.status === "missing_db_contract") {
    return "El domicilio local todavia depende de migraciones manuales pendientes en Supabase.";
  }

  if (localDelivery.status === "missing_business_configuration") {
    return "El negocio aun no termina de configurar su domicilio local.";
  }

  if (localDelivery.status === "catalog_unavailable") {
    return "El catalogo geografico no esta disponible en este momento.";
  }

  return null;
}

function getDeliverySummaryCopy(options: {
  deliveryType: DeliveryType | "";
  localDelivery: StorefrontLocalDeliveryConfig;
  quote: LocalDeliveryQuote | null;
  isQuoting: boolean;
  selectedNeighborhoodId: string;
}) {
  if (!options.deliveryType) {
    return "Elige una entrega";
  }

  if (options.deliveryType !== "domicilio") {
    return "No aplica";
  }

  if (options.isQuoting) {
    return "Cotizando...";
  }

  if (options.quote?.status === "available" && options.quote.deliveryFee !== null) {
    return formatCurrency(options.quote.deliveryFee);
  }

  if (options.quote?.status === "out_of_coverage") {
    return "Fuera de cobertura";
  }

  if (options.quote?.status === "neighborhood_not_available") {
    return "Barrio no disponible";
  }

  if (
    options.quote?.status === "schema_not_ready" ||
    options.localDelivery.status === "missing_db_contract"
  ) {
    return "Pendiente por migraciones";
  }

  if (
    options.quote?.status === "catalog_unavailable" ||
    options.localDelivery.status === "catalog_unavailable"
  ) {
    return "Catalogo no disponible";
  }

  if (
    options.quote?.status === "missing_business_configuration" ||
    options.localDelivery.status === "missing_business_configuration"
  ) {
    return "Configuracion pendiente";
  }

  if (options.quote?.status === "business_disabled" || options.localDelivery.status === "disabled") {
    return "No disponible";
  }

  return options.selectedNeighborhoodId ? "Cotizacion pendiente" : "Selecciona tu barrio";
}

function getSummaryHeaderProgress(steps: Array<{ label: string; supporting: string; complete: boolean }>) {
  const totalSteps = steps.length;
  const nextStepIndex = steps.findIndex((step) => !step.complete);
  const isComplete = nextStepIndex === -1;
  const currentStep = isComplete ? totalSteps : nextStepIndex + 1;
  const completedSteps = steps.filter((step) => step.complete).length;

  if (isComplete) {
    return {
      currentStep,
      completedSteps,
      totalSteps,
      isComplete,
      title: "Confirmación",
      subtitle: "Revisa el resumen final y confirma tu pedido para enviarlo al negocio.",
    };
  }

  if (currentStep === 1) {
    return {
      currentStep,
      completedSteps,
      totalSteps,
      isComplete,
      title: "A nombre de quién va tu pedido?",
      subtitle: "Déjanos tus datos para identificar tu compra y poder contactarte.",
    };
  }

  if (currentStep === 2) {
    return {
      currentStep,
      completedSteps,
      totalSteps,
      isComplete,
      title: "Arma tu pedido",
      subtitle: "Agrega los productos y cantidades que deseas pedir.",
    };
  }

  if (currentStep === 3) {
    return {
      currentStep,
      completedSteps,
      totalSteps,
      isComplete,
      title: "Entrega y pago",
      subtitle: "Define cómo recibirás tu pedido y cómo prefieres pagarlo.",
    };
  }

  return {
    currentStep,
    completedSteps,
    totalSteps,
    isComplete,
    title: "Confirmación",
    subtitle: "Revisa el resumen final y confirma tu pedido para enviarlo al negocio.",
  };
}

function paymentHint(method: PaymentMethod, deliveryType?: DeliveryType) {
  if (method === "Transferencia") {
    return "Acelera la confirmacion del pedido.";
  }

  if (method === "Tarjeta") {
    return "Pago inmediato si esta habilitada.";
  }

  if (method === "Contra entrega") {
    return deliveryType === "domicilio"
      ? "Pagas al recibir."
      : "Solo disponible a domicilio.";
  }

  return deliveryType === "domicilio"
    ? "Pagas al recibir."
    : "Pagas al retirar.";
}

function paymentBadge(method: PaymentMethod) {
  if (method === "Transferencia") {
    return "Recomendado";
  }

  if (method === "Tarjeta") {
    return "Digital";
  }

  if (method === "Contra entrega") {
    return "Solo domicilio";
  }

  return "Simple";
}

function getCheckoutNudge({
  customerReady,
  productsReady,
  fulfillmentReady,
  privacyAccepted,
}: {
  customerReady: boolean;
  productsReady: boolean;
  fulfillmentReady: boolean;
  privacyAccepted: boolean;
}) {
  if (!customerReady) {
    return "Completa tu nombre y WhatsApp para que el pedido se pueda confirmar sin friccion.";
  }

  if (!productsReady) {
    return "Agrega al menos un producto para activar el total en vivo y el cierre del pedido.";
  }

  if (!fulfillmentReady) {
    return "Elige entrega y pago para dejar claro como vas a recibir y cerrar la compra.";
  }

  if (!privacyAccepted) {
    return "Autoriza el tratamiento de datos y el pedido quedara listo para enviarse.";
  }

  return "Todo esta listo. Solo falta confirmar el pedido.";
}

function getMobileCtaLabel({
  customerReady,
  productsReady,
  fulfillmentReady,
  privacyAccepted,
}: {
  customerReady: boolean;
  productsReady: boolean;
  fulfillmentReady: boolean;
  privacyAccepted: boolean;
}) {
  if (!productsReady) {
    return "Agrega productos";
  }

  if (!customerReady) {
    return "Completa tus datos";
  }

  if (!fulfillmentReady) {
    return "Entrega y pago";
  }

  if (!privacyAccepted) {
    return "Autoriza y confirma";
  }

  return "Confirmar pedido";
}

function SectionFrame({
  sectionId,
  step,
  title,
  description,
  icon: Icon,
  children,
  status,
  complete = false,
  highlight = false,
  compact = false,
}: {
  sectionId?: string;
  step: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  status?: ReactNode;
  complete?: boolean;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      id={sectionId}
      className={`relative overflow-hidden rounded-[36px] border ${
        highlight
          ? "border-[#E8DDD0] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFDF9_100%)] shadow-[0_22px_60px_rgba(23,32,51,0.09)]"
          : "border-[#E8DDD0] bg-[#FFFDF9] shadow-[0_18px_56px_rgba(23,32,51,0.08)]"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_100%)]" />

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] text-white shadow-[0_16px_34px_rgba(23,32,51,0.14)] ${
                complete
                  ? "bg-emerald-500"
                  : highlight
                    ? "bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)]"
                    : "bg-[#172033]"
              }`}
            >
              {complete ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <Icon className="h-6 w-6" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7C8798]">
                {step}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5B6472]">
                {description}
              </p>
            </div>
          </div>

          {status}
        </div>
      </div>

      <div className={compact ? "px-4 pb-3.5 sm:px-5 sm:pb-4.5" : "px-5 pb-5 sm:px-6 sm:pb-6"}>
        {children}
      </div>
    </section>
  );
}

function Err({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-2 flex items-start gap-2 rounded-[18px] border border-rose-200 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-700">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone = "neutral",
  icon,
  compact = false,
}: {
  label: string;
  tone?: "neutral" | "warm" | "success";
  icon?: ReactNode;
  compact?: boolean;
}) {
  const toneClassName =
    tone === "success"
      ? "bg-[#EAFBF4] text-[#047857] ring-[#A7F3D0]"
      : tone === "warm"
        ? "bg-[#FFF3D6] text-[#B45309] ring-[#F3D39A]"
        : "bg-[#F6EFE6] text-[#5B6472] ring-[#E8DDD0]";

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ${compact ? "gap-1 px-2 py-0.5 text-[9px] tracking-[0.14em]" : "gap-1.5 px-3 py-1 text-[11px] tracking-[0.18em]"} font-black uppercase ${toneClassName}`}
    >
      {icon}
      {label}
    </span>
  );
}

function TrustChip({
  icon: Icon,
  label,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border border-[#E8DDD0] bg-[#FFFDF9]/95 px-4 py-3 shadow-[0_14px_32px_rgba(23,32,51,0.06)] backdrop-blur">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#FFF3D6_0%,#FFFDF9_100%)] text-[#D97706] ring-1 ring-[#E8DDD0]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-tight text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-[#5B6472]">{description}</p>
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  supporting,
  badge,
  icon: Icon,
  selected,
  featured = false,
  disabled = false,
  onClick,
  testId,
  value,
  compact = false,
}: {
  title: string;
  description: string;
  supporting: string;
  badge: string;
  icon: ComponentType<{ className?: string }>;
  selected: boolean;
  featured?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
  value: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        data-testid={testId}
        data-choice-value={value}
        aria-pressed={selected}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={onClick}
        className={`group flex h-full w-full flex-col rounded-[20px] border p-3 text-left transition-all sm:rounded-[22px] sm:p-3.5 ${
          disabled
            ? "cursor-not-allowed border-[#E8DDD0] bg-[#F7F2EB] text-slate-500 opacity-75"
            : selected
            ? "border-[#F3D39A] bg-[linear-gradient(180deg,#FFF7E2_0%,#FFFDF9_100%)] shadow-[0_12px_24px_rgba(217,119,6,0.11)] ring-1 ring-[#F6D8A8]"
            : "border-[#E8DDD0] bg-[#FFFDF9] hover:-translate-y-0.5 hover:border-[#D8C8B5] hover:shadow-[0_10px_22px_rgba(23,32,51,0.06)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill label={badge} tone={featured ? "warm" : "neutral"} compact />
              {featured ? (
                <StatusPill
                  label="Recomendado"
                  tone="success"
                  compact
                  icon={<Sparkles className="h-3 w-3" />}
                />
              ) : null}
            </div>
            <h3 className="mt-1.5 text-[0.98rem] font-black leading-5 tracking-tight text-slate-900">
              {title}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-4.5 text-[#5B6472]">{description}</p>
          </div>
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] ${
              disabled
                ? "bg-[#E8DDD0] text-[#7C8798]"
                : selected
                ? "bg-[#F59E0B] text-white shadow-[0_8px_16px_rgba(245,158,11,0.18)]"
                : "bg-[#F7F1E8] text-[#5B6472] ring-1 ring-[#E8DDD0] group-hover:text-[#D97706]"
            }`}
          >
            {selected && !disabled ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium leading-4.5 text-[#7C8798]">{supporting}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      data-choice-value={value}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={`group flex h-full w-full flex-col justify-between rounded-[24px] border p-4 text-left transition-all sm:rounded-[28px] sm:p-5 ${
        disabled
          ? "cursor-not-allowed border-[#E8DDD0] bg-[#F7F2EB] text-slate-500 opacity-75"
          : selected
          ? "border-[#F3D39A] bg-[linear-gradient(180deg,#FFF3D6_0%,#FFFDF9_100%)] shadow-[0_18px_42px_rgba(217,119,6,0.12)] ring-1 ring-[#F6D8A8]"
          : "border-[#E8DDD0] bg-[#FFFDF9] hover:-translate-y-0.5 hover:border-[#D8C8B5] hover:shadow-[0_16px_38px_rgba(23,32,51,0.08)]"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={badge} tone={featured ? "warm" : "neutral"} />
              {featured ? (
                <StatusPill
                  label="Recomendado"
                  tone="success"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                />
              ) : null}
            </div>
            <h3 className="mt-3 text-base font-black tracking-tight text-slate-900 sm:mt-4 sm:text-lg">
              {title}
            </h3>
            <p className="mt-1.5 text-sm leading-5 text-[#5B6472] sm:mt-2 sm:leading-6">
              {description}
            </p>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] sm:h-12 sm:w-12 sm:rounded-[18px] ${
              disabled
                ? "bg-[#E8DDD0] text-[#7C8798]"
                : selected
                ? "bg-[#F59E0B] text-white shadow-[0_12px_26px_rgba(245,158,11,0.22)]"
                : "bg-[#172033] text-white group-hover:bg-[#D97706]"
            }`}
          >
            {selected && !disabled ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
        </div>
        <p
          className={`mt-3 rounded-[18px] bg-[#F6EFE6]/75 px-3.5 py-2.5 text-xs leading-5 text-[#5B6472] ring-1 ring-[#E8DDD0] sm:mt-4 sm:rounded-[20px] sm:px-4 sm:py-3 sm:text-sm sm:leading-6 ${
            selected ? "block" : "hidden sm:block"
          }`}
        >
          {supporting}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5">
        <span className="text-xs font-bold text-[#7C8798]">
          {disabled ? "No disponible ahora" : selected ? "Listo para tu pedido" : "Toca para elegir"}
        </span>
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3D6] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#B45309] ring-1 ring-[#F3D39A]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Seleccionado
          </span>
        ) : disabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECE6DD] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6B7280] ring-1 ring-[#DDD2C3]">
            No disponible
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-[#7C8798]">
            Elegir
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </button>
  );
}

function ProductCard({
  product,
  quantity,
  onDecrease,
  onIncrease,
  compact = false,
  recentlyUpdated = false,
}: {
  product: BusinessProduct;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
  recentlyUpdated?: boolean;
}) {
  const active = quantity > 0;
  const initials = getProductInitials(product.name);

  return (
    <article
      className={`group relative overflow-hidden rounded-[28px] border transition-all sm:rounded-[32px] ${
        active
          ? "border-[#BFE8D3] bg-[linear-gradient(180deg,#F4FFF8_0%,#FFFDF9_100%)] shadow-[0_22px_54px_rgba(16,185,129,0.12)]"
          : "border-[#E8DDD0] bg-[#FFFDF9] hover:-translate-y-0.5 hover:border-[#D8C8B5] hover:shadow-[0_16px_40px_rgba(23,32,51,0.08)]"
      } ${recentlyUpdated ? "ring-2 ring-[#A7F3D0] ring-offset-2 ring-offset-[#FCF8F3]" : ""}`}
    >
      {recentlyUpdated ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_26px_rgba(16,185,129,0.24)]">
          +1 agregado
        </div>
      ) : null}

      <div
        className={`relative overflow-hidden ${
          compact
            ? "rounded-[20px] px-3 py-3 sm:rounded-[22px] sm:px-3.5 sm:py-3.5"
            : "rounded-b-[22px] rounded-t-[28px] px-4 py-4 sm:rounded-b-[26px] sm:rounded-t-[32px] sm:px-5 sm:py-5"
        } ${compact ? "bg-[#FFFDF9]" : "bg-[linear-gradient(135deg,rgba(245,158,11,0.12)_0%,rgba(255,243,214,0.56)_46%,rgba(255,253,249,0.96)_100%)]"}`}
      >
        {compact ? null : <div className="absolute -left-8 top-4 h-24 w-24 rounded-full bg-[#FDE7B1] blur-2xl" />}
        {compact ? null : <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/80 blur-3xl" />}

        <div
          className={`relative ${
            compact
              ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3"
              : "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2"
          }`}
        >
          <div
            className={`min-w-0 ${
              compact
                ? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5"
                : "col-start-1 row-start-1 row-span-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1"
            }`}
          >
            <div
              className={`row-span-2 flex shrink-0 items-center justify-center rounded-[16px] bg-[#FFFDF9] text-base font-black text-slate-900 shadow-[0_12px_24px_rgba(23,32,51,0.08)] ring-1 ring-white ${
                compact
                  ? "h-11 w-11 sm:h-12 sm:w-12 sm:text-sm"
                  : "h-12 w-12 sm:h-14 sm:w-14 sm:rounded-[20px] sm:text-lg"
              }`}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <h3
                className={`${
                  compact ? "text-sm sm:text-[0.95rem]" : "text-lg"
                } font-black tracking-tight text-slate-900`}
              >
                {product.name}
              </h3>
            </div>

            <p
              className={`col-start-2 min-w-0 line-clamp-1 leading-5 text-[#5B6472] ${
                compact ? "text-[11px] sm:text-xs" : "text-sm"
              }`}
            >
              {product.description}
            </p>
          </div>

          <div
            className={`text-right ${
              compact
                ? "flex shrink-0 flex-col items-end justify-center gap-2 pl-2"
                : "row-span-2 rounded-[18px] bg-[#FFFDF9]/95 px-3 py-2.5 shadow-[0_12px_24px_rgba(23,32,51,0.06)] ring-1 ring-white sm:rounded-[22px] sm:px-4 sm:py-3"
            }`}
          >
            <div className="flex items-baseline justify-end gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7C8798]">
                Precio
              </p>
              <p className={`${compact ? "text-lg" : "text-xl"} font-black tracking-tight text-slate-900`}>
                {formatCurrency(product.price)}
              </p>
            </div>

            <div
              className={`flex items-center gap-2 rounded-[22px] bg-[#F6EFE6] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${
                compact ? "p-1" : "p-1.5"
              }`}
            >
              <button
                type="button"
                onClick={onDecrease}
                aria-label={`Restar ${product.name}`}
                className={`flex items-center justify-center rounded-[18px] border transition active:scale-95 ${
                  active
                    ? "border-[#BFE8D3] bg-[#F1FFF7] text-[#047857] hover:bg-[#E7FBEF]"
                    : "border-[#E8DDD0] bg-[#FFFDF9] text-[#7C8798] hover:text-slate-900"
                } ${compact ? "h-10 w-10 sm:h-10 sm:w-10 sm:rounded-[14px]" : "h-12 w-12 sm:h-11 sm:w-11 sm:rounded-[16px]"}`}
              >
                <Minus className="h-4 w-4" />
              </button>

              <span
                className={`text-center font-black tabular-nums text-slate-900 ${
                  compact ? "min-w-[38px] text-base sm:min-w-[40px]" : "min-w-[46px] text-lg sm:min-w-[42px]"
                }`}
              >
                {quantity}
              </span>

              <button
                type="button"
                onClick={onIncrease}
                aria-label={`Sumar ${product.name}`}
                className={`flex items-center justify-center rounded-[18px] border border-[#D97706] bg-[#F59E0B] text-white transition hover:bg-[#D97706] active:scale-95 ${
                  compact ? "h-10 w-10 sm:h-10 sm:w-10 sm:rounded-[14px]" : "h-12 w-12 sm:h-11 sm:w-11 sm:rounded-[16px]"
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryPanel({
  businessName,
  subtotal,
  total,
  deliverySummary,
  deliveryType,
  paymentMethod,
  selectedProducts,
  productCount,
  isSubmitting,
  submitError,
  onConfirm,
  steps,
}: {
  businessName: string;
  subtotal: number;
  total: number;
  deliverySummary: string;
  deliveryType: DeliveryType | "";
  paymentMethod: PaymentMethod | "";
  selectedProducts: OrderProduct[];
  productCount: number;
  isSubmitting: boolean;
  submitError: string;
  onConfirm: () => void;
  steps: Array<{ label: string; supporting: string; complete: boolean }>;
}) {
  const hasProducts = selectedProducts.length > 0;
  const visibleProducts = selectedProducts.slice(0, 5);
  const hiddenProductsCount = selectedProducts.length - visibleProducts.length;
  const progressHeader = getSummaryHeaderProgress(steps);
  const progressPercent = (progressHeader.completedSteps / progressHeader.totalSteps) * 100;

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#E8DDD0] bg-[#FFFDF9] shadow-[0_18px_44px_rgba(23,32,51,0.09)]">
      <div className="border-b border-[#E8DDD0] bg-[linear-gradient(135deg,#F6EFE6_0%,#FFFDF9_100%)] px-4 py-3 sm:px-4.5 sm:py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D97706]">
              Resumen del pedido
            </p>
            <h3 className="mt-1 text-[1.02rem] font-black leading-tight tracking-tight text-slate-900 sm:text-[1.08rem]">
              {progressHeader.title}
            </h3>
            <p className="mt-1 max-w-[30ch] text-[11px] leading-4.5 text-[#5B6472] sm:text-xs sm:leading-5">
              {progressHeader.subtitle}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Total</p>
            <p className="mt-0.5 text-[1.7rem] font-black leading-none tracking-tight text-slate-900">
              {formatCurrency(total)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-[#F1E7DB]">
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-300 ${
                  progressHeader.isComplete
                    ? "bg-[linear-gradient(90deg,#10B981_0%,#059669_100%)]"
                    : "bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_100%)]"
                }`}
                style={{ width: `${Math.max(progressPercent, 6)}%` }}
              />
            </div>
          </div>
          <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
            Paso {progressHeader.currentStep} de {progressHeader.totalSteps}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-4.5 sm:py-3.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-[#EFE5DA] pb-3 sm:hidden">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Total</p>
            <p className="mt-0.5 text-lg font-black tracking-tight text-slate-900">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Unidades</p>
            <p className="mt-0.5 text-lg font-black tracking-tight text-slate-900">{productCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Entrega</p>
            <p className="mt-0.5 text-sm font-black text-slate-900">{deliveryType ? deliveryTitle(deliveryType) : "Pendiente"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Pago</p>
            <p className="mt-0.5 text-sm font-black text-slate-900">
              {paymentMethod ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined) : "Pendiente"}
            </p>
          </div>
        </div>

        <div className="border-b border-[#EFE5DA] pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7C8798]">
                Productos agregados
              </p>
              <p className="mt-0.5 text-sm font-black tracking-tight text-slate-900">
                {hasProducts ? `${selectedProducts.length} producto(s) distintos` : "Tu pedido aun esta vacio"}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#B45309]">
              {productCount} uds.
            </span>
          </div>

          {hasProducts ? (
            <ul className="mt-2 space-y-0 divide-y divide-[#EFE5DA]">
              {visibleProducts.map((product) => {
                const unitPrice = product.unitPrice ?? 0;

                return (
                  <li key={product.productId} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black leading-5 text-slate-900">{product.name}</p>
                      <p className="text-[11px] leading-4 text-[#7C8798]">
                        {product.quantity} u. {unitPrice > 0 ? `- ${formatCurrency(unitPrice)} c/u` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black leading-5 text-slate-900">
                      {formatCurrency(unitPrice * product.quantity)}
                    </span>
                  </li>
                );
              })}
              {hiddenProductsCount > 0 ? (
                <li className="pt-2 text-[11px] font-bold text-[#B45309]">
                  + {hiddenProductsCount} producto(s) mas dentro del pedido
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-[#7C8798]">
              Apenas sumes algo, aqui veras cantidades y subtotal sin inflar el resumen.
            </p>
          )}
        </div>

        <div className="space-y-2.5 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Subtotal</span>
            <span className="text-sm font-black tabular-nums text-slate-900">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Domicilio</span>
            <span className="text-sm font-bold text-[#5B6472]">{deliverySummary}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#F3EADF] pt-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Total</span>
            <span className="text-base font-black tabular-nums text-slate-900">{formatCurrency(total)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Pago</span>
            <span className="text-sm font-bold text-slate-900">
              {paymentMethod ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined) : "Pendiente"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Negocio</span>
            <span className="text-right text-sm font-bold text-slate-900">{businessName}</span>
          </div>
        </div>

        {submitError ? (
          <div className="border-t border-rose-200 py-3 text-sm font-medium text-rose-700">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[#EFE5DA] pt-3">
          <button
            data-testid="storefront-submit-order-button"
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || productCount === 0}
            className="group flex w-full items-center justify-center gap-2.5 rounded-[22px] bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)] px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_34px_rgba(217,119,6,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(217,119,6,0.24)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{isSubmitting ? "Enviando pedido..." : "Confirmar pedido"}</span>
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}

function MobileStickyCheckoutSummary({
  total,
  productCount,
  summaryHeader,
  nextStepCopy,
  ctaLabel,
  canSubmit,
  isSubmitting,
  isKeyboardOpen,
  onConfirm,
}: {
  total: number;
  productCount: number;
  summaryHeader: ReturnType<typeof getSummaryHeaderProgress>;
  nextStepCopy: string;
  ctaLabel: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  isKeyboardOpen: boolean;
  onConfirm: () => void;
}) {
  const progressPercent = (summaryHeader.completedSteps / summaryHeader.totalSteps) * 100;
  const compact = isKeyboardOpen;
  const progressTone = summaryHeader.isComplete ? "success" : productCount > 0 ? "warm" : "neutral";

  return (
    <section
      data-testid="storefront-mobile-summary-sticky"
      className="sticky top-0 z-30 -mx-4 border-b border-[#E8DDD0] bg-[linear-gradient(180deg,rgba(252,248,243,0.98)_0%,rgba(255,253,249,0.98)_100%)] px-4 py-2 shadow-[0_12px_28px_rgba(23,32,51,0.08)] backdrop-blur-sm sm:-mx-6 lg:hidden"
    >
      <div className="mx-auto max-w-7xl">
        <div
          className={`rounded-[24px] border border-[#E8DDD0] bg-[#FFFDF9]/96 shadow-[0_10px_26px_rgba(23,32,51,0.08)] ${
            compact ? "p-2.5" : "p-3"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#D97706]">
                Resumen del pedido
              </p>
              <p className={`${compact ? "mt-0.5 text-lg" : "mt-1 text-2xl"} font-black tracking-tight text-slate-900`}>
                {formatCurrency(total)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusPill
                label={`${productCount} uds.`}
                tone={productCount > 0 ? "warm" : "neutral"}
                compact
              />
              <StatusPill
                label={summaryHeader.isComplete ? "Pedido listo" : `Paso ${summaryHeader.currentStep} de ${summaryHeader.totalSteps}`}
                tone={progressTone}
                compact
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F1E7DB]">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-300 ${
                    summaryHeader.isComplete
                      ? "bg-[linear-gradient(90deg,#10B981_0%,#059669_100%)]"
                      : "bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_100%)]"
                  }`}
                  style={{ width: `${Math.max(progressPercent, 6)}%` }}
                />
              </div>
            </div>
            <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
              Paso {summaryHeader.currentStep} de {summaryHeader.totalSteps}
            </p>
          </div>

          <div
            className={`mt-2 flex items-center justify-between gap-2 ${
              compact ? "text-[11px]" : "text-xs"
            } text-[#5B6472]`}
          >
            <p className="min-w-0 flex-1 truncate">{compact ? "Teclado activo" : nextStepCopy}</p>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting || !canSubmit}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)] px-3.5 py-2.5 text-[11px] font-black text-white shadow-[0_12px_24px_rgba(217,119,6,0.18)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{isSubmitting ? "Enviando" : ctaLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfirmationView({
  business,
  confirmedOrder,
}: {
  business: BusinessConfig;
  confirmedOrder: Order;
}) {
  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,#FCF8F3_0%,#FFFDF9_52%,#FCF8F3_100%)] px-4 py-6 sm:px-6"
      data-testid="storefront-order-confirmation"
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center">
        <section className="w-full overflow-hidden rounded-[36px] border border-[#E8DDD0] bg-[#FFFDF9] shadow-[0_24px_80px_rgba(23,32,51,0.12)]">
          <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-6 sm:px-8">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-emerald-100 p-4 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-5 text-sm font-black uppercase tracking-[0.24em] text-emerald-600">
                Pedido confirmado
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                Tu compra ya quedo registrada
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5B6472]">
                <strong>{business.name}</strong> ya puede tomar tu pedido. Guarda el numero visible
                para seguimiento o soporte.
              </p>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-[#E8DDD0] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFDF9_100%)] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D97706]">
                  Codigo del pedido
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#172033] px-4 py-2 text-sm font-black text-white">
                    {getOrderDisplayCode(confirmedOrder)}
                  </span>
                  <StatusPill
                    label="Registrado"
                    tone="success"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  />
                </div>

                <dl className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="flex items-start justify-between gap-4">
                    <dt>Cliente</dt>
                    <dd className="text-right font-medium text-slate-900">{confirmedOrder.client}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>WhatsApp</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {confirmedOrder.customerPhone}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>Total</dt>
                    <dd className="text-right font-black text-slate-900">
                      {formatCurrency(confirmedOrder.total)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt>Creado</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatCreatedAt(confirmedOrder.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[28px] border border-[#E8DDD0] bg-[#FFFDF9] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7C8798]">
                  Resumen de compra
                </p>
                <div className="mt-4 space-y-3">
                  {confirmedOrder.products.map((product, index) => (
                    <div
                      key={`${product.productId ?? product.name}-${index}`}
                      className="flex items-start justify-between gap-4 rounded-[22px] bg-[#F6EFE6]/55 px-4 py-3 ring-1 ring-[#E8DDD0]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{product.name}</p>
                        <p className="mt-1 text-xs text-[#7C8798]">
                          {product.quantity} x {formatCurrency(product.unitPrice ?? 0)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-black text-slate-900">
                        {formatCurrency((product.unitPrice ?? 0) * product.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-[#E8DDD0] bg-[#FFFDF9] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7C8798]">
                  Siguiente paso
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                  El negocio ya puede continuar con tu pedido
                </h2>
                <div className="mt-4 space-y-3">
                  <TrustChip
                    icon={CheckCircle2}
                    label="Confirmacion operativa"
                    description="Si hace falta coordinar algo, el negocio usara el mismo canal de contacto."
                  />
                  <TrustChip
                    icon={Clock3}
                    label="Seguimiento simple"
                    description="Conserva el codigo del pedido para cualquier aclaracion."
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#E8DDD0] bg-[linear-gradient(180deg,#F6EFE6_0%,#FFFDF9_100%)] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5B6472]">
                  Tranquilidad
                </p>
                <p className="mt-2 text-sm leading-6 text-[#5B6472]">
                  Tus datos quedan asociados solo a la gestion de esta compra y a la coordinacion de
                  entrega o retiro.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function StorefrontOrderWizard({ business }: { business: BusinessConfig }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "">("");
  const [deliveryNeighborhoodId, setDeliveryNeighborhoodId] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [observations, setObservations] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuotingDelivery, setIsQuotingDelivery] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [localDeliveryQuote, setLocalDeliveryQuote] = useState<LocalDeliveryQuote | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [recentlyUpdatedProductId, setRecentlyUpdatedProductId] = useState<string | null>(null);
  const [recentlyAddedProductName, setRecentlyAddedProductName] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileHeroVisible, setIsMobileHeroVisible] = useState(true);
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);
  const heroTitleRef = useRef<HTMLDivElement | null>(null);
  const keyboardViewportBaselineRef = useRef<number | null>(null);
  const keyboardUpdateFrameRef = useRef<number | null>(null);

  const deferredProductQuery = useDeferredValue(productQuery);
  const hasValidWhatsApp = isValidWhatsAppPhone(customerPhone);
  const showAddressField = deliveryType === "domicilio";
  const localDeliveryConfig = business.localDelivery;
  const availablePaymentMethods = useMemo(
    () => getAvailablePaymentMethods(deliveryType, business.availablePaymentMethods),
    [business.availablePaymentMethods, deliveryType],
  );
  const selected = useMemo(() => selectedProducts(business, quantities), [business, quantities]);
  const subtotal = useMemo(() => calculateOrderProductsSubtotal(selected), [selected]);
  const resolvedDeliveryFee =
    deliveryType === "domicilio" && localDeliveryQuote?.status === "available"
      ? localDeliveryQuote.deliveryFee ?? 0
      : 0;
  const total = subtotal + resolvedDeliveryFee;
  const productCount = countProducts(quantities);
  const filtered = useMemo(
    () => business.products.filter((product) => matchProduct(product, deferredProductQuery)),
    [business.products, deferredProductQuery],
  );
  const visibleProducts = deferredProductQuery.trim().length > 0 ? filtered : business.products;
  const visiblePaymentMethods = deliveryType ? availablePaymentMethods : [];
  const customerReady = customerName.trim().length > 0 && hasValidWhatsApp;
  const productsReady = productCount > 0;
  const localDeliveryReady =
    deliveryType !== "domicilio" ||
    (localDeliveryQuote?.status === "available" && resolvedDeliveryFee >= 0);
  const fulfillmentReady = Boolean(
    deliveryType &&
      paymentMethod &&
      (!showAddressField || (address.trim().length > 0 && localDeliveryReady)),
  );
  const confirmationReady = customerReady && productsReady && fulfillmentReady && privacyAccepted;
  const localDeliveryConfigMessage = getLocalDeliveryConfigMessage(localDeliveryConfig);
  const deliveryOptions = useMemo(
    () =>
      business.availableDeliveryTypes.map((type) => {
        const disabled = type === "domicilio" && localDeliveryConfig.status !== "available";

        return {
          type,
          disabled,
          supporting:
            type === "domicilio" && disabled && localDeliveryConfigMessage
              ? localDeliveryConfigMessage
              : deliverySupport(type),
        };
      }),
    [business.availableDeliveryTypes, localDeliveryConfig.status, localDeliveryConfigMessage],
  );
  const deliverySummary = getDeliverySummaryCopy({
    deliveryType,
    localDelivery: localDeliveryConfig,
    quote: localDeliveryQuote,
    isQuoting: isQuotingDelivery,
    selectedNeighborhoodId: deliveryNeighborhoodId,
  });
  const progressSteps = [
    {
      label: "Tus datos",
      supporting: customerReady ? "Listo para confirmar" : "Nombre y WhatsApp",
      complete: customerReady,
    },
    {
      label: "Productos",
      supporting: productsReady ? `${productCount} unidades elegidas` : "Arma tu pedido",
      complete: productsReady,
    },
    {
      label: "Entrega y pago",
      supporting: fulfillmentReady ? "Ruta de compra definida" : "Como lo recibes y pagas",
      complete: fulfillmentReady,
    },
    {
      label: "Confirmacion",
      supporting: confirmationReady ? "Listo para enviar" : "Ultimo paso",
      complete: confirmationReady,
    },
  ];
  const nextStepCopy = getCheckoutNudge({
    customerReady,
    productsReady,
    fulfillmentReady,
    privacyAccepted,
  });
  const mobileCtaLabel = getMobileCtaLabel({
    customerReady,
    productsReady,
    fulfillmentReady,
    privacyAccepted,
  });
  const headerSupportLine = resolveStorefrontSubline(business.tagline);
  const summaryHeader = getSummaryHeaderProgress(progressSteps);
  const isMobileSummaryVisible = isMobileViewport && !isMobileHeroVisible;

  useEffect(() => {
    if (!recentlyUpdatedProductId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setRecentlyUpdatedProductId(null), 1100);
    return () => window.clearTimeout(timeout);
  }, [recentlyUpdatedProductId]);

  useEffect(() => {
    if (!recentlyAddedProductName) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setRecentlyAddedProductName(""), 1600);
    return () => window.clearTimeout(timeout);
  }, [recentlyAddedProductName]);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    const heroNode = heroTitleRef.current;

    if (!heroNode || typeof IntersectionObserver === "undefined") {
      setIsMobileHeroVisible(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMobileHeroVisible(Boolean(entry?.isIntersecting));
      },
      {
        threshold: 0.01,
      },
    );

    observer.observe(heroNode);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

    const updateKeyboardBaseline = () => {
      const currentHeight = getViewportHeight();

      if (
        keyboardViewportBaselineRef.current === null ||
        currentHeight > keyboardViewportBaselineRef.current
      ) {
        keyboardViewportBaselineRef.current = currentHeight;
      }
    };

    const updateKeyboardState = () => {
      const viewportHeight = getViewportHeight();
      const activeElement = document.activeElement;
      updateKeyboardBaseline();
      const baselineHeight = keyboardViewportBaselineRef.current ?? viewportHeight;
      const isKeyboardLikelyOpen =
        window.innerWidth < 1024 &&
        isEditableElement(activeElement) &&
        (baselineHeight - viewportHeight > 90 || window.innerHeight - viewportHeight > 90);

      setIsMobileKeyboardOpen(isKeyboardLikelyOpen);

      if (!isKeyboardLikelyOpen) {
        updateKeyboardBaseline();
      }
    };

    const scheduleKeyboardStateUpdate = () => {
      if (keyboardUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(keyboardUpdateFrameRef.current);
      }

      keyboardUpdateFrameRef.current = window.requestAnimationFrame(() => {
        keyboardUpdateFrameRef.current = null;
        updateKeyboardState();
      });
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableElement(event.target)) {
        return;
      }

      setIsMobileKeyboardOpen(window.innerWidth < 1024);
      window.setTimeout(scheduleKeyboardStateUpdate, 80);
    };

    const onFocusOut = () => {
      window.setTimeout(scheduleKeyboardStateUpdate, 120);
    };

    const onViewportChange = () => {
      scheduleKeyboardStateUpdate();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);

    updateKeyboardState();

    return () => {
      if (keyboardUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(keyboardUpdateFrameRef.current);
        keyboardUpdateFrameRef.current = null;
      }

      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
    };
  }, []);

  useEffect(() => {
    if (deliveryType !== "domicilio") {
      setIsQuotingDelivery(false);
      setLocalDeliveryQuote(null);
      return undefined;
    }

    if (localDeliveryConfig.status !== "available") {
      setIsQuotingDelivery(false);
      setLocalDeliveryQuote(null);
      return undefined;
    }

    if (!deliveryNeighborhoodId) {
      setIsQuotingDelivery(false);
      setLocalDeliveryQuote(null);
      return undefined;
    }

    let cancelled = false;
    setLocalDeliveryQuote(null);
    setIsQuotingDelivery(true);

    void fetchStorefrontLocalDeliveryQuote({
      businessSlug: business.businessSlug,
      neighborhoodId: deliveryNeighborhoodId,
    })
      .then((quote) => {
        if (cancelled) {
          return;
        }

        setLocalDeliveryQuote(quote);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLocalDeliveryQuote({
          status: "catalog_unavailable",
          deliveryFee: null,
          message:
            error instanceof Error
              ? error.message
              : "No fue posible cotizar el domicilio local.",
          context: null,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsQuotingDelivery(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [business.businessSlug, deliveryNeighborhoodId, deliveryType, localDeliveryConfig.status]);

  function clearError(field: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, (current[productId] ?? 0) + delta),
    }));
    clearError("products");

    if (delta > 0) {
      const product = business.products.find((candidate) => candidate.productId === productId);
      setRecentlyUpdatedProductId(productId);
      setRecentlyAddedProductName(product?.name ?? "Producto");
    }
  }

  function validateAll() {
    const nextErrors: Record<string, string> = {};

    if (!customerName.trim()) {
      nextErrors.customerName = "Escribe tu nombre para continuar.";
    }

    if (!customerPhone.trim()) {
      nextErrors.customerPhone = "Escribe tu celular con WhatsApp.";
    } else if (!hasValidWhatsApp) {
      nextErrors.customerPhone = "Escribe un WhatsApp valido para continuar.";
    }

    if (productCount === 0) {
      nextErrors.products = "Agrega al menos un producto al pedido.";
    }

    if (!deliveryType) {
      nextErrors.deliveryType = "Selecciona como quieres recibir el pedido.";
    }

    if (!paymentMethod) {
      nextErrors.paymentMethod = "Selecciona un metodo de pago.";
    }

    if (deliveryType === "domicilio") {
      if (localDeliveryConfig.status !== "available") {
        nextErrors.deliveryNeighborhoodId =
          localDeliveryConfigMessage ??
          "El domicilio local no esta disponible de forma valida para este negocio.";
      } else if (!deliveryNeighborhoodId) {
        nextErrors.deliveryNeighborhoodId = "Selecciona el barrio para cotizar el domicilio.";
      } else if (!localDeliveryQuote || localDeliveryQuote.status !== "available") {
        nextErrors.deliveryNeighborhoodId =
          localDeliveryQuote?.message ?? "No pudimos resolver una tarifa valida para el domicilio.";
      }

      if (!address.trim()) {
        nextErrors.address = "La direccion es obligatoria para domicilio.";
      }
    }

    if (!privacyAccepted) {
      nextErrors.privacyAccepted = "Debes autorizar el tratamiento de datos para enviar.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function selectDeliveryType(nextDeliveryType: DeliveryType) {
    if (nextDeliveryType === "domicilio" && localDeliveryConfig.status !== "available") {
      clearError("deliveryType");
      clearError("deliveryNeighborhoodId");
      setSubmitError("");
      return;
    }

    setDeliveryType(nextDeliveryType);
    clearError("deliveryType");
    clearError("address");
    clearError("deliveryNeighborhoodId");
    setSubmitError("");

    if (nextDeliveryType !== "domicilio") {
      setDeliveryNeighborhoodId("");
      setAddress("");
      setDeliveryReference("");
      setLocalDeliveryQuote(null);
    }

    if (
      paymentMethod &&
      !getAvailablePaymentMethods(nextDeliveryType, business.availablePaymentMethods).includes(
        paymentMethod,
      )
    ) {
      setPaymentMethod("");
      clearError("paymentMethod");
    }
  }

  async function handleConfirmOrder() {
    if (!validateAll() || !paymentMethod || !deliveryType) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const persisted = await createStorefrontOrderViaApi({
        businessSlug: business.businessSlug,
        customerName: customerName.trim(),
        customerWhatsApp: customerPhone.trim(),
        deliveryType,
        deliveryAddress: deliveryType === "domicilio" ? address.trim() : undefined,
        deliveryNeighborhoodId:
          deliveryType === "domicilio" ? deliveryNeighborhoodId : undefined,
        deliveryReference:
          deliveryType === "domicilio" ? deliveryReference.trim() || undefined : undefined,
        paymentMethod,
        notes: observations.trim() || undefined,
        total,
        products: selected,
      });
      setConfirmedOrder(persisted);
    } catch (error) {
      debugError("[storefront] Remote order persistence failed", {
        businessSlug: business.businessSlug,
      });
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No fue posible enviar tu pedido. Intenta de nuevo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return <ConfirmationView business={business} confirmedOrder={confirmedOrder} />;
  }

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),transparent_24%),radial-gradient(circle_at_top_right,_rgba(23,32,51,0.06),transparent_26%),linear-gradient(180deg,#FCF8F3_0%,#FFF8EE_52%,#FCF8F3_100%)]"
      data-testid="storefront-order-wizard"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-3 sm:px-6 sm:pb-24 sm:pt-6 lg:pb-28">
        <section className="relative overflow-hidden rounded-[32px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-4 shadow-[0_22px_60px_rgba(23,32,51,0.08)] sm:rounded-[36px] sm:px-6 sm:py-5 lg:px-6 lg:py-4.5">
          <div className="absolute -left-20 top-0 h-48 w-48 rounded-full bg-[#FDE7B1] blur-3xl" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#F6EFE6] blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.92fr)] lg:items-center lg:gap-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-to-br ${business.accent} shadow-[0_16px_36px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:h-12 sm:w-12 sm:rounded-[20px]`}
                >
                  <Store className="h-5 w-5 text-slate-800 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#D97706]">
                    Haz tu compra fácil y rápido
                  </p>
                </div>
              </div>

              <div ref={heroTitleRef} className="mt-3 max-w-[46rem] sm:mt-4">
                <p className="text-sm font-black tracking-tight text-slate-900">Pide directo aqui</p>
                <h1 className="max-w-[22ch] text-[2.15rem] font-black tracking-[-0.04em] text-slate-900 [text-wrap:balance] sm:text-[2.7rem] sm:leading-[0.98] lg:max-w-[24ch] lg:text-[3.45rem] lg:leading-[0.96]">
                  {business.name}
                </h1>
                <p className="mt-2 max-w-[38rem] text-sm leading-6 text-[#5B6472] sm:text-base sm:leading-7">
                  {headerSupportLine}
                </p>
              </div>
            </div>

            <div className="min-w-0 lg:pl-2">
              <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {STOREFRONT_HEADER_BENEFITS.map(({ icon: Icon, copy }) => (
                  <div key={copy} className="flex min-w-0 flex-col items-start gap-2.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#FFF7EB] text-[#D97706] shadow-[0_14px_30px_rgba(217,119,6,0.12)] ring-1 ring-[#F3D39A] sm:h-14 sm:w-14 sm:rounded-[20px]">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <p className="max-w-[14ch] text-sm font-black leading-5 tracking-[-0.02em] text-slate-900 sm:text-[0.95rem] sm:leading-6">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isMobileSummaryVisible ? (
          <MobileStickyCheckoutSummary
            total={total}
            productCount={productCount}
            summaryHeader={summaryHeader}
            nextStepCopy={nextStepCopy}
            ctaLabel={mobileCtaLabel}
            canSubmit={productCount > 0}
            isSubmitting={isSubmitting}
            isKeyboardOpen={isMobileKeyboardOpen}
            onConfirm={() => void handleConfirmOrder()}
          />
        ) : null}

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="space-y-6">
            <SectionFrame
              step="Paso 1"
              title="A nombre de quien va tu pedido?"
              description="Completa este bloque y el resto del checkout se siente rapido y sin fricciones."
              icon={User}
              complete={customerReady}
              status={
                customerReady ? (
                  <StatusPill
                    label="Bloque completo"
                    tone="success"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  />
                ) : (
                  <StatusPill
                    label="Te tomara segundos"
                    tone="neutral"
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                  />
                )
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black tracking-tight text-slate-900">
                    Nombre completo
                  </span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="customerName"
                      data-testid="storefront-customer-name-input"
                      value={customerName}
                      onChange={(event) => {
                        setCustomerName(event.target.value);
                        clearError("customerName");
                      }}
                      placeholder="Ej: Juan Perez"
                      autoComplete="name"
                      className={`w-full rounded-[24px] border bg-[#F6EFE6]/65 py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] ${
                        errors.customerName
                          ? "border-rose-200 focus:border-rose-400"
                          : "border-[#E8DDD0] focus:border-[#F59E0B]"
                      }`}
                    />
                  </div>
                  <Err message={errors.customerName} />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black tracking-tight text-slate-900">
                    Numero de WhatsApp
                  </span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="customerPhone"
                      data-testid="storefront-customer-phone-input"
                      value={customerPhone}
                      onChange={(event) => {
                        setCustomerPhone(event.target.value);
                        clearError("customerPhone");
                      }}
                      placeholder="300 123 4567"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`w-full rounded-[24px] border bg-[#F6EFE6]/65 py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] ${
                        errors.customerPhone
                          ? "border-rose-200 focus:border-rose-400"
                          : "border-[#E8DDD0] focus:border-[#F59E0B]"
                      }`}
                    />
                  </div>
                  <Err message={errors.customerPhone} />
                </label>
              </div>

              <div
                className={`mt-5 rounded-[26px] border p-4 ${
                  customerReady
                    ? "border-[#A7F3D0] bg-[#EAFBF4]"
                    : "border-[#E8DDD0] bg-[#F6EFE6]/65"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ${
                      customerReady ? "bg-emerald-500 text-white" : "bg-[#FFFDF9] text-[#D97706]"
                    } shadow-sm ring-1 ${
                      customerReady ? "ring-[#A7F3D0]" : "ring-[#E8DDD0]"
                    }`}
                  >
                    {customerReady ? <CheckCircle2 className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-slate-900">
                      {customerReady ? "Tus datos ya quedaron listos" : "Te contactaremos solo para confirmar tu pedido"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#5B6472]">
                      {customerReady
                        ? "Perfecto. Ya podemos asociar el pedido a una persona real y seguir con la compra."
                        : "No usamos este dato para otra cosa distinta a procesar la compra y coordinar la entrega o el retiro."}
                    </p>
                  </div>
                </div>
              </div>
            </SectionFrame>

            <SectionFrame
              sectionId="storefront-products-section"
              step="Paso 2"
              title="Arma tu pedido"
              description="Tu pedido se arma en vivo mientras eliges."
              icon={ShoppingBag}
              complete={productsReady}
              highlight
              status={
                <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                  <label className="relative block lg:justify-self-end lg:w-full lg:max-w-[360px]">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="Busca por nombre o descripción"
                      className="w-full rounded-[20px] border border-[#E8DDD0] bg-[#F6EFE6]/65 py-3 pl-11 pr-4 text-[16px] sm:text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#F59E0B] focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6]"
                    />
                  </label>
                  <span className="rounded-full bg-[#FFF3D6] px-3 py-1.5 ring-1 ring-[#F3D39A] text-[11px] font-black uppercase tracking-[0.18em] text-[#B45309]">
                    Catalogo actualizado
                  </span>
                      
                </div>
              }
            >
              <div className="space-y-3">
                
                {errors.products ? (
                  <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>{errors.products}</span>
                    </div>
                  </div>
                ) : null}

                <div
                  data-testid="storefront-inline-products"
                  className="space-y-2"
                >
                  {visibleProducts.length > 0 ? (
                    visibleProducts.map((product) => (
                      <ProductCard
                        key={product.productId}
                        product={product}
                        quantity={quantities[product.productId] ?? 0}
                        onDecrease={() => updateQuantity(product.productId, -1)}
                        onIncrease={() => updateQuantity(product.productId, 1)}
                        compact
                        recentlyUpdated={recentlyUpdatedProductId === product.productId}
                      />
                    ))
                  ) : (
                    <div className="rounded-[24px] border-2 border-dashed border-[#E8DDD0] bg-[#FFFDF9]/90 px-5 py-8 text-center sm:col-span-2 xl:col-span-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF3D6] text-[#D97706] ring-1 ring-[#F3D39A]">
                        <Search className="h-6 w-6" />
                      </div>
                      <p className="mt-4 text-sm font-black text-slate-900">No hay resultados</p>
                      <p className="mt-2 text-sm leading-6 text-[#7C8798]">
                        Prueba otra busqueda para seguir sumando.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </SectionFrame>
            <SectionFrame
              step="Paso 3"
              title="Entrega y pago"
              description="Elige la entrega y luego te mostramos solo los pagos compatibles."
              icon={Truck}
              complete={fulfillmentReady}
              compact
              status={
                fulfillmentReady ? (
                  <StatusPill
                    label="Ruta definida"
                    tone="success"
                    compact
                    icon={<CheckCircle2 className="h-3 w-3" />}
                  />
                ) : (
                  <StatusPill label="Falta completar" tone="warm" compact icon={<Truck className="h-3 w-3" />} />
                )
              }
            >
              <div className="space-y-3">
                <div className="rounded-[20px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:px-3.5 sm:py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Entrega
                      </p>
                      <h3 className="mt-0.5 text-[15px] font-black tracking-tight text-slate-900 sm:text-base">
                        Elige como quieres recibirlo
                      </h3>
                      <p className="mt-0.5 max-w-[42rem] text-[13px] leading-4.5 text-[#5B6472]">
                        Primero defines la entrega y luego ves los pagos compatibles.
                      </p>
                    </div>
                    <StatusPill
                      label={deliveryType ? "Elegida" : "Pendiente"}
                      tone={deliveryType ? "success" : "neutral"}
                      compact
                    />
                  </div>

                  <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
                    {deliveryOptions.map(({ type, disabled, supporting }) => (
                      <ChoiceCard
                        key={type}
                        title={deliveryTitle(type)}
                        description={deliveryDescription(type)}
                        supporting={supporting}
                        badge={deliveryBadge(type)}
                        icon={type === "domicilio" ? Truck : Store}
                        selected={deliveryType === type}
                        disabled={disabled}
                        onClick={() => selectDeliveryType(type)}
                        testId={`storefront-delivery-option-${slugifyChoice(type)}`}
                        value={type}
                        compact
                      />
                    ))}
                  </div>
                  <Err message={errors.deliveryType} />
                </div>

                {showAddressField ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-[20px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:px-3.5 sm:py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Domicilio local
                          </p>
                          <h3 className="mt-0.5 text-[15px] font-black tracking-tight text-slate-900 sm:text-base">
                            Selecciona tu barrio y escribe la direccion
                          </h3>
                          <p className="mt-0.5 max-w-[42rem] text-[13px] leading-4.5 text-[#5B6472]">
                            El cliente no elige tarifa: el sistema la calcula y la valida antes de guardar el pedido.
                          </p>
                        </div>
                        <StatusPill
                          label={isQuotingDelivery ? "Cotizando" : localDeliveryQuote?.status === "available" ? "Tarifa lista" : "Pendiente"}
                          tone={localDeliveryQuote?.status === "available" ? "success" : "neutral"}
                          compact
                        />
                      </div>

                      {localDeliveryConfig.status === "available" ? (
                        <label className="space-y-2">
                          <span className="text-sm font-black tracking-tight text-slate-900">
                            Barrio
                          </span>
                          <select
                            data-testid="storefront-delivery-neighborhood-select"
                            value={deliveryNeighborhoodId}
                            onChange={(event) => {
                              const nextNeighborhoodId = event.target.value;
                              setDeliveryNeighborhoodId(nextNeighborhoodId);
                              setLocalDeliveryQuote(null);
                              setIsQuotingDelivery(
                                localDeliveryConfig.status === "available" && nextNeighborhoodId.length > 0,
                              );
                              clearError("deliveryNeighborhoodId");
                              setSubmitError("");
                            }}
                            className={`w-full rounded-[20px] border bg-[#F6EFE6]/65 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] ${
                              errors.deliveryNeighborhoodId
                                ? "border-rose-200 focus:border-rose-400"
                                : "border-[#E8DDD0] focus:border-[#F59E0B]"
                            }`}
                          >
                            <option value="">Selecciona tu barrio</option>
                            {localDeliveryConfig.destinationNeighborhoods.map((neighborhood) => (
                              <option key={neighborhood.neighborhoodId} value={neighborhood.neighborhoodId}>
                                {neighborhood.name} · {neighborhood.cityName}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs leading-5 text-[#7C8798]">
                            Solo mostramos barrios del catalogo controlado por la plataforma.
                          </p>
                          <Err message={errors.deliveryNeighborhoodId} />
                        </label>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[#E8DDD0] bg-[#F8F2EA] px-3.5 py-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] bg-[#FFFDF9] text-[#D97706] ring-1 ring-[#E8DDD0]">
                              <Info className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">
                                Domicilio local no disponible para cotizar
                              </p>
                              <p className="mt-0.5 text-sm leading-4.5 text-slate-600">
                                {localDeliveryConfigMessage}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {showAddressField && (deliveryNeighborhoodId || localDeliveryQuote || localDeliveryConfigMessage) ? (
                        <div
                          data-testid="storefront-delivery-quote-state"
                          className={`rounded-[18px] border px-3.5 py-3 ${
                            localDeliveryQuote?.status === "available"
                              ? "border-emerald-200 bg-emerald-50/80"
                              : localDeliveryQuote?.status === "out_of_coverage" ||
                                  localDeliveryQuote?.status === "neighborhood_not_available"
                                ? "border-rose-200 bg-rose-50"
                                : "border-[#E8DDD0] bg-[#F8F2EA]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] bg-white text-slate-900 ring-1 ring-black/5">
                              {localDeliveryQuote?.status === "available" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Info className="h-4 w-4 text-[#D97706]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">
                                {deliverySummary}
                              </p>
                              <p className="mt-0.5 text-sm leading-4.5 text-slate-600">
                                {isQuotingDelivery
                                  ? "Estamos validando el valor final del domicilio para este barrio."
                                  : localDeliveryQuote?.message ??
                                    localDeliveryConfigMessage ??
                                    "Selecciona tu barrio para ver el valor final del domicilio."}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <label className="space-y-2">
                        <span className="text-sm font-black tracking-tight text-slate-900">
                          Direccion de entrega
                        </span>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" />
                          <textarea
                            rows={2}
                            data-testid="storefront-delivery-address-input"
                            value={address}
                            onChange={(event) => {
                              setAddress(event.target.value);
                              clearError("address");
                            }}
                            placeholder="Calle, numero, apartamento o indicaciones"
                            className={`w-full rounded-[20px] border bg-[#F6EFE6]/65 py-3 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] ${
                              errors.address
                                ? "border-rose-200 focus:border-rose-400"
                                : "border-[#E8DDD0] focus:border-[#F59E0B]"
                            }`}
                          />
                        </div>
                        <p className="text-xs leading-5 text-[#7C8798]">
                          La usamos solo para coordinar el domicilio de forma correcta.
                        </p>
                        <Err message={errors.address} />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-black tracking-tight text-slate-900">
                          Referencia de entrega
                        </span>
                        <input
                          type="text"
                          data-testid="storefront-delivery-reference-input"
                          value={deliveryReference}
                          onChange={(event) => setDeliveryReference(event.target.value)}
                          placeholder="Ej: porteria azul, casa esquina, local 2"
                          className="w-full rounded-[20px] border border-[#E8DDD0] bg-[#F6EFE6]/65 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#F59E0B] focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6]"
                        />
                        <p className="text-xs leading-5 text-[#7C8798]">
                          Ayuda a la entrega, pero no define la tarifa.
                        </p>
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[20px] border border-slate-200 bg-white p-3 sm:rounded-[24px] sm:px-3.5 sm:py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Pago
                      </p>
                      <h3 className="mt-0.5 text-[15px] font-black tracking-tight text-slate-900 sm:text-base">
                        Elige como quieres pagarlo
                      </h3>
                      <p className="mt-0.5 max-w-[42rem] text-[13px] leading-4.5 text-[#5B6472]">
                        Mostramos solo los metodos que aplican a tu entrega.
                      </p>
                    </div>
                    <StatusPill
                      label={paymentMethod ? "Elegido" : "Pendiente"}
                      tone={paymentMethod ? "success" : "neutral"}
                      compact
                    />
                  </div>

                  <div className="mt-2.5">
                    {deliveryType ? (
                      visiblePaymentMethods.length > 0 ? (
                        <div className="grid gap-2.5 md:grid-cols-2">
                          {visiblePaymentMethods.map((method) => (
                            <ChoiceCard
                              key={method}
                              title={getPaymentMethodLabel(method, deliveryType || undefined)}
                              description={paymentHint(method, deliveryType)}
                              supporting={
                                method === "Transferencia"
                                  ? "Validacion mas agil."
                                  : method === "Contra entrega"
                                    ? "Segun la entrega elegida."
                                    : method === "Tarjeta"
                                      ? "Si el negocio la tiene habilitada."
                                      : "Pagas al recibir o al retirar."
                              }
                              badge={paymentBadge(method)}
                              icon={CreditCard}
                              selected={paymentMethod === method}
                              featured={method === "Transferencia"}
                              onClick={() => {
                                setPaymentMethod(method);
                                clearError("paymentMethod");
                              }}
                              testId={`storefront-payment-option-${slugifyChoice(method)}`}
                              value={method}
                              compact
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[#E8DDD0] bg-[#F8F2EA] px-3.5 py-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] bg-[#FFFDF9] text-[#D97706] ring-1 ring-[#E8DDD0]">
                              <Info className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">
                                No hay pagos publicos compatibles con esta entrega.
                              </p>
                              <p className="mt-0.5 text-sm leading-4.5 text-slate-600">
                                El negocio necesita habilitar un metodo valido para este carril.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-[#E8DDD0] bg-[#F8F2EA] px-3.5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] bg-[#FFFDF9] text-[#D97706] ring-1 ring-[#E8DDD0]">
                            <Info className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              Elige primero la entrega
                            </p>
                            <p className="mt-0.5 text-sm leading-4.5 text-slate-600">
                              Asi solo mostramos metodos reales y compatibles con tu pedido.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Err message={errors.paymentMethod} />
                </div>
              </div>
            </SectionFrame>
            <SectionFrame
              step="Paso 4"
              title="Confirmación"
              description="Deja una nota opcional y confirma la compra con tranquilidad."
              icon={Shield}
              complete={confirmationReady}
              status={
                confirmationReady ? (
                  <StatusPill
                    label="Listo para enviar"
                    tone="success"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  />
                ) : (
                  <StatusPill
                    label="Últimos detalles"
                    tone="warm"
                    icon={<Shield className="h-3.5 w-3.5" />}
                  />
                )
              }
            >
              <div className="space-y-3">
                <div className="rounded-[24px] border border-[#E9E2D8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF8_100%)] p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.03)] sm:rounded-[28px] sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Observaciones
                      </p>
                      <h3 className="mt-1 text-[1.05rem] font-black leading-tight tracking-tight text-slate-900">
                        Si quieres, agrega una nota
                      </h3>
                      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-600">
                        Déjanos una indicación útil para preparar o entregar mejor tu pedido.
                      </p>
                    </div>
                    <StatusPill label="Opcional" tone="neutral" />
                  </div>

                  <div className="mt-3 border-t border-[#F1E9DE] pt-3">
                    <label className="block">
                      <div className="relative">
                        <MessageSquare className="pointer-events-none absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <textarea
                          rows={3}
                          data-testid="storefront-order-notes-input"
                          value={observations}
                          onChange={(event) => setObservations(event.target.value)}
                          placeholder="Ej: sin salsa, llamar al llegar..."
                          className="min-h-[84px] w-full rounded-[22px] border border-[#E7D9C9] bg-[#FCF8F3] py-3 pl-11 pr-4 text-[16px] font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#F59E0B] focus:bg-white focus:ring-4 focus:ring-[#FDE7BE]/60"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#E9E2D8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFCF8_100%)] p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.03)] sm:rounded-[28px] sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Autorización de datos
                      </p>
                      <h3 className="mt-1 text-[1.05rem] font-black leading-tight tracking-tight text-slate-900">
                        Solo para gestionar tu pedido
                      </h3>
                      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-600">
                        Necesitamos tu autorización para confirmar la compra y coordinar la entrega.
                      </p>
                    </div>
                    <StatusPill
                      label={privacyAccepted ? "Aceptada" : "Pendiente"}
                      tone={privacyAccepted ? "success" : "neutral"}
                    />
                  </div>

                  <div className="mt-3 border-t border-[#F1E9DE] pt-3">
                    <div
                      className={`rounded-[22px] border p-3.5 transition-all sm:p-4 ${
                        privacyAccepted
                          ? "border-[#B7E7CC] bg-[linear-gradient(180deg,#F3FFF8_0%,#ECFBF3_100%)]"
                          : "border-[#E8DDD0] bg-[linear-gradient(180deg,#FFFAF4_0%,#FCF5EC_100%)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#FFFDF9] text-slate-900 shadow-[0_4px_10px_rgba(15,23,42,0.05)] ring-1 ring-[#E8DDD0]">
                          <Shield className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <label className="flex cursor-pointer items-start gap-3">
                            <div className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                              <input
                                type="checkbox"
                                data-testid="storefront-privacy-checkbox"
                                checked={privacyAccepted}
                                onChange={(event) => {
                                  setPrivacyAccepted(event.target.checked);
                                  clearError("privacyAccepted");
                                }}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-emerald-600 checked:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                              />
                              <CheckCircle2 className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-black leading-6 text-slate-900">
                                Autorizo usar mis datos para gestionar este pedido y coordinar su entrega.
                              </p>
                              <p className="text-sm leading-5 text-slate-600">
                                Se usan solo para confirmar tu compra y coordinar la entrega o retiro.
                              </p>
                            </div>
                          </label>

                          <p className="mt-3 text-xs leading-5 text-slate-600">
                            Puedes revisar la{" "}
                            <Link
                              href="/legal/privacidad"
                              className="font-black text-[#B45309] underline decoration-2 underline-offset-4"
                            >
                              política de tratamiento
                            </Link>{" "}
                            antes de confirmar.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Err message={errors.privacyAccepted} />
                  </div>
                </div>
              </div>
            </SectionFrame>
          </div>

          <aside className="lg:sticky lg:top-6">
            <SummaryPanel
              businessName={business.name}
              subtotal={subtotal}
              total={total}
              deliverySummary={deliverySummary}
              deliveryType={deliveryType}
              paymentMethod={paymentMethod}
              selectedProducts={selected}
              productCount={productCount}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onConfirm={() => void handleConfirmOrder()}
              steps={progressSteps}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}


