"use client";

import Link from "next/link";
import {
  type ComponentType,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Gift,
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
import { createStorefrontOrderViaApi } from "@/lib/orders/api";
import { isValidWhatsAppPhone } from "@/lib/whatsapp";
import {
  getOrderDisplayCode,
  type DeliveryType,
  type Order,
  type OrderProduct,
  type PaymentMethod,
} from "@/types/orders";
import type { BusinessConfig, BusinessProduct } from "@/types/storefront";

const DEFAULT_BUSINESS_TAGLINE = "Negocio operativo conectado a la base principal de Tecpify.";

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
    return "Arma tu pedido, elige entrega y pago, y dejalo listo para confirmacion por WhatsApp.";
  }

  return normalizedTagline;
}

function deliveryTitle(type: DeliveryType) {
  return type === "domicilio" ? "Domicilio" : "Recoger en tienda";
}

function deliveryDescription(type: DeliveryType) {
  return type === "domicilio"
    ? "Recibelo en tu direccion con una coordinacion clara por WhatsApp."
    : "Retira directo en el negocio y evita pasos extra.";
}

function deliverySupport(type: DeliveryType) {
  return type === "domicilio"
    ? "Costo de entrega: se confirma segun la zona."
    : "Costo de entrega: sin costo adicional.";
}

function deliveryBadge(type: DeliveryType) {
  return type === "domicilio" ? "Comodidad" : "Mas rapido";
}

function deliveryCostCopy(type: DeliveryType | "") {
  if (!type) {
    return "Elige una entrega";
  }

  return type === "domicilio" ? "Se confirma segun zona" : "Sin costo adicional";
}

function paymentHint(method: PaymentMethod, deliveryType?: DeliveryType) {
  if (method === "Transferencia") {
    return "Acelera la confirmacion y deja el cierre mas agil.";
  }

  if (method === "Tarjeta") {
    return "Pago inmediato si el negocio lo tiene habilitado.";
  }

  if (method === "Contra entrega") {
    return deliveryType === "domicilio"
      ? "Pagas cuando recibes el pedido."
      : "Disponible solo cuando la entrega es a domicilio.";
  }

  return deliveryType === "domicilio"
    ? "Pagas al recibir el pedido."
    : "Pagas al retirar tu compra.";
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

function getActiveBenefit({
  deliveryType,
  paymentMethod,
  selectedFeaturedCount,
  productCount,
}: {
  deliveryType: DeliveryType | "";
  paymentMethod: PaymentMethod | "";
  selectedFeaturedCount: number;
  productCount: number;
}) {
  if (paymentMethod === "Transferencia") {
    return "Confirmacion mas agil al validar el comprobante.";
  }

  if (deliveryType === "recogida en tienda") {
    return "Retiras sin costo de envio y con menos pasos.";
  }

  if (selectedFeaturedCount > 0) {
    return `Llevas ${selectedFeaturedCount} destacado${selectedFeaturedCount > 1 ? "s" : ""} del negocio en tu compra.`;
  }

  if (productCount > 1) {
    return "Tu pedido ya va tomando forma y el total se actualiza en vivo.";
  }

  return "Confirmacion rapida por WhatsApp una vez envies el pedido.";
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
              {complete ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#7C8798]">
                {step}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5B6472]">{description}</p>
            </div>
          </div>
          {status}
        </div>
      </div>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
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
}: {
  label: string;
  tone?: "neutral" | "warm" | "success";
  icon?: ReactNode;
}) {
  const toneClassName =
    tone === "success"
      ? "bg-[#EAFBF4] text-[#047857] ring-[#A7F3D0]"
      : tone === "warm"
        ? "bg-[#FFF3D6] text-[#B45309] ring-[#F3D39A]"
        : "bg-[#F6EFE6] text-[#5B6472] ring-[#E8DDD0]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ring-1 ${toneClassName}`}
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

function ProgressOverview({
  steps,
  progressPercent,
}: {
  steps: Array<{ label: string; supporting: string; complete: boolean }>;
  progressPercent: number;
}) {
  const nextStepIndex = steps.findIndex((step) => !step.complete);

  return (
    <div className="rounded-[28px] border border-[#E8DDD0] bg-[#FFFDF9]/95 p-4 shadow-[0_18px_48px_rgba(23,32,51,0.08)] sm:rounded-[32px] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#D97706]">
            Checkout guiado
          </p>
          <h2 className="mt-1.5 text-lg font-black tracking-tight text-slate-900 sm:mt-2 sm:text-xl">
            Tu progreso esta claro desde el inicio
          </h2>
        </div>
        <div className="rounded-[18px] bg-[#172033] px-3 py-2.5 text-center text-[#F8FAFC] sm:rounded-[22px] sm:px-4 sm:py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
            Avance
          </p>
          <p className="mt-1 text-xl font-black sm:text-2xl">{Math.round(progressPercent)}%</p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#F6EFE6] sm:mt-5 sm:h-3">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_100%)] transition-[width] duration-500"
          style={{ width: `${Math.max(progressPercent, 6)}%` }}
        />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:hidden">
        {steps.map((step, index) => {
          const isFocused = index === (nextStepIndex === -1 ? steps.length - 1 : nextStepIndex);

          return (
            <div
              key={`${step.label}-mobile`}
              className={`min-w-[180px] rounded-[20px] border px-3.5 py-3 ${
                step.complete
                  ? "border-[#A7F3D0] bg-[#EAFBF4]"
                  : isFocused
                    ? "border-[#F3D39A] bg-[linear-gradient(180deg,#FFF3D6_0%,#FFFDF9_100%)]"
                    : "border-[#E8DDD0] bg-[#F6EFE6]/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] text-xs font-black ${
                    step.complete
                      ? "bg-emerald-500 text-white"
                      : isFocused
                        ? "bg-[#172033] text-white"
                        : "bg-[#FFFDF9] text-[#7C8798] ring-1 ring-[#E8DDD0]"
                  }`}
                >
                  {step.complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black tracking-tight text-slate-900">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#5B6472]">{step.supporting}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2">
        {steps.map((step, index) => {
          const isFocused = index === (nextStepIndex === -1 ? steps.length - 1 : nextStepIndex);

          return (
            <div
              key={step.label}
              className={`rounded-[24px] border p-4 transition-all ${
                step.complete
                  ? "border-[#A7F3D0] bg-[#EAFBF4]"
                  : isFocused
                    ? "border-[#F3D39A] bg-[linear-gradient(180deg,#FFF3D6_0%,#FFFDF9_100%)]"
                    : "border-[#E8DDD0] bg-[#F6EFE6]/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-sm font-black ${
                    step.complete
                      ? "bg-emerald-500 text-white"
                      : isFocused
                        ? "bg-[#172033] text-white"
                        : "bg-[#FFFDF9] text-[#7C8798] ring-1 ring-[#E8DDD0]"
                  }`}
                >
                  {step.complete ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black tracking-tight text-slate-900">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#5B6472]">{step.supporting}</p>
                </div>
              </div>
            </div>
          );
        })}
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
  onClick,
  testId,
  value,
}: {
  title: string;
  description: string;
  supporting: string;
  badge: string;
  icon: ComponentType<{ className?: string }>;
  selected: boolean;
  featured?: boolean;
  onClick: () => void;
  testId: string;
  value: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-choice-value={value}
      aria-pressed={selected}
      onClick={onClick}
      className={`group flex h-full w-full flex-col justify-between rounded-[24px] border p-4 text-left transition-all sm:rounded-[28px] sm:p-5 ${
        selected
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
              selected
                ? "bg-[#F59E0B] text-white shadow-[0_12px_26px_rgba(245,158,11,0.22)]"
                : "bg-[#172033] text-white group-hover:bg-[#D97706]"
            }`}
          >
            <Icon className="h-5 w-5" />
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
          {selected ? "Listo para tu pedido" : "Toca para elegir"}
        </span>
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3D6] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#B45309] ring-1 ring-[#F3D39A]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Seleccionado
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
          ? "border-[#F3D39A] bg-[linear-gradient(180deg,#FFF8E8_0%,#FFFDF9_100%)] shadow-[0_20px_48px_rgba(217,119,6,0.12)]"
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
          compact ? "rounded-b-[20px] rounded-t-[26px] px-3.5 py-3.5 sm:rounded-b-[24px] sm:rounded-t-[30px] sm:px-4 sm:py-4" : "rounded-b-[22px] rounded-t-[28px] px-4 py-4 sm:rounded-b-[26px] sm:rounded-t-[32px] sm:px-5 sm:py-5"
        } bg-[linear-gradient(135deg,rgba(245,158,11,0.14)_0%,rgba(255,243,214,0.7)_46%,rgba(255,253,249,0.95)_100%)]`}
      >
        <div className="absolute -left-8 top-4 h-24 w-24 rounded-full bg-[#FDE7B1] blur-2xl" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/80 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {product.isFeatured ? (
                <StatusPill
                  label="Destacado"
                  tone="warm"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                />
              ) : null}
              {active ? (
                <StatusPill
                  label="En tu pedido"
                  tone="success"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                />
              ) : null}
            </div>
            <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FFFDF9]/95 text-base font-black text-slate-900 shadow-[0_12px_24px_rgba(23,32,51,0.08)] ring-1 ring-white sm:mt-4 sm:h-14 sm:w-14 sm:rounded-[20px] sm:text-lg">
              {initials}
            </div>
          </div>
          <div className="rounded-[18px] bg-[#FFFDF9]/95 px-3 py-2.5 text-right shadow-[0_12px_24px_rgba(23,32,51,0.06)] ring-1 ring-white sm:rounded-[22px] sm:px-4 sm:py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
              Precio
            </p>
            <p className={`${compact ? "text-lg" : "text-xl"} mt-1 font-black tracking-tight text-slate-900`}>
              {formatCurrency(product.price)}
            </p>
          </div>
        </div>
      </div>

      <div className={compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}>
        <h3 className={`${compact ? "text-base" : "text-lg"} font-black tracking-tight text-slate-900`}>
          {product.name}
        </h3>
        <p className={`mt-2 line-clamp-2 leading-6 text-[#5B6472] ${compact ? "text-xs" : "text-sm"}`}>
          {product.description}
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:mt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center justify-between gap-2 rounded-[22px] bg-[#F6EFE6] p-1.5">
            <button
              type="button"
              onClick={onDecrease}
              aria-label={`Restar ${product.name}`}
              className={`flex h-14 w-14 items-center justify-center rounded-[18px] border transition active:scale-95 sm:h-12 sm:w-12 sm:rounded-[16px] ${
                active
                  ? "border-[#F6D8A8] bg-[#FFF8E8] text-[#B45309] hover:bg-[#FFF3D6]"
                  : "border-[#E8DDD0] bg-[#FFFDF9] text-[#7C8798] hover:text-slate-900"
              }`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center text-xl font-black tabular-nums text-slate-900 sm:min-w-[44px] sm:text-lg">
              {quantity}
            </span>
            <button
              type="button"
              onClick={onIncrease}
              aria-label={`Sumar ${product.name}`}
              className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#D97706] bg-[#F59E0B] text-white transition hover:bg-[#D97706] active:scale-95 sm:h-12 sm:w-12 sm:rounded-[16px]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="text-right sm:min-w-[96px]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
              Total linea
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {quantity > 0 ? formatCurrency(product.price * quantity) : "Aun sin sumar"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryPanel({
  businessName,
  total,
  deliveryType,
  paymentMethod,
  selectedProducts,
  productCount,
  isSubmitting,
  submitError,
  onConfirm,
  progressPercent,
  completedSteps,
  nextStepCopy,
  activeBenefit,
}: {
  businessName: string;
  total: number;
  deliveryType: DeliveryType | "";
  paymentMethod: PaymentMethod | "";
  selectedProducts: OrderProduct[];
  productCount: number;
  isSubmitting: boolean;
  submitError: string;
  onConfirm: () => void;
  progressPercent: number;
  completedSteps: number;
  nextStepCopy: string;
  activeBenefit: string;
}) {
  const hasProducts = selectedProducts.length > 0;
  const visibleProducts = selectedProducts.slice(0, 4);
  const hiddenProductsCount = selectedProducts.length - visibleProducts.length;

  return (
    <section className="overflow-hidden rounded-[36px] border border-[#E8DDD0] bg-[#FFFDF9] shadow-[0_24px_70px_rgba(23,32,51,0.12)]">
      <div className="border-b border-[#E8DDD0] bg-[linear-gradient(135deg,#F6EFE6_0%,#FFFDF9_100%)] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#D97706]">
              Resumen que convierte
            </p>
            <h3 className="mt-1.5 text-xl font-black tracking-tight text-slate-900 sm:mt-2 sm:text-2xl">
              Tu pedido se arma en vivo
            </h3>
            <p className="mt-1.5 text-sm leading-5 text-[#5B6472] sm:mt-2 sm:leading-6">
              {nextStepCopy}
            </p>
          </div>
          <div className="rounded-[18px] bg-[#172033] px-3 py-2.5 text-center text-[#F8FAFC] sm:rounded-[22px] sm:px-4 sm:py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
              Progreso
            </p>
            <p className="mt-1 text-xl font-black sm:text-2xl">{completedSteps}/4</p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#F6EFE6] sm:mt-5">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#F59E0B_0%,#D97706_100%)] transition-[width] duration-500"
            style={{ width: `${Math.max(progressPercent, 6)}%` }}
          />
        </div>
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid grid-cols-2 gap-3 sm:hidden">
          <div className="rounded-[22px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-3 shadow-[0_8px_28px_rgba(23,32,51,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Total</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-900">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-[22px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-3 shadow-[0_8px_28px_rgba(23,32,51,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Unidades</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-900">{productCount}</p>
          </div>
          <div className="rounded-[22px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-3 shadow-[0_8px_28px_rgba(23,32,51,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Entrega</p>
            <p className="mt-1 text-sm font-black text-slate-900">{deliveryType ? deliveryTitle(deliveryType) : "Pendiente"}</p>
          </div>
          <div className="rounded-[22px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-3 shadow-[0_8px_28px_rgba(23,32,51,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7C8798]">Pago</p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {paymentMethod ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined) : "Pendiente"}
            </p>
          </div>
        </div>

        <div className="hidden rounded-[28px] border border-[#E8DDD0] bg-[#FFFDF9] p-4 shadow-[0_8px_28px_rgba(23,32,51,0.05)] sm:block">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7C8798]">
                Productos agregados
              </p>
              <p className="mt-1 text-sm font-black tracking-tight text-slate-900">
                {hasProducts ? `${selectedProducts.length} producto(s) distintos` : "Tu carrito sigue vacio"}
              </p>
            </div>
            <StatusPill label={`${productCount} unidades`} tone={hasProducts ? "warm" : "neutral"} />
          </div>

          {hasProducts ? (
            <div className="space-y-3">
              {visibleProducts.map((product) => {
                const unitPrice = product.unitPrice ?? 0;

                return (
                  <div
                    key={product.productId}
                    className="flex items-start justify-between gap-4 rounded-[22px] border border-[#EFE5DA] bg-[#F6EFE6]/55 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[#7C8798]">
                        {product.quantity} x {formatCurrency(unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-slate-900">
                      {formatCurrency(unitPrice * product.quantity)}
                    </span>
                  </div>
                );
              })}
              {hiddenProductsCount > 0 ? (
                <div className="rounded-[20px] bg-[#FFF3D6] px-4 py-3 text-sm font-bold text-[#B45309] ring-1 ring-[#F3D39A]">
                  + {hiddenProductsCount} producto(s) mas dentro del pedido
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[24px] border-2 border-dashed border-[#E8DDD0] bg-[#F6EFE6]/55 px-4 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFFDF9] text-[#D97706] shadow-sm ring-1 ring-[#E8DDD0]">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-black text-slate-900">Agrega tu primer producto</p>
              <p className="mt-2 text-xs leading-5 text-[#7C8798]">
                Apenas sumes algo, este panel te mostrara el total y la ruta para cerrar el pedido.
              </p>
            </div>
          )}
        </div>

        <div className="hidden rounded-[28px] border border-[#E8DDD0] bg-[#FFFDF9] p-4 shadow-[0_8px_28px_rgba(23,32,51,0.05)] sm:block">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
                Subtotal
              </span>
              <span className="text-sm font-black tabular-nums text-slate-900">{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
                Costo de entrega
              </span>
              <span className="text-sm font-bold text-[#5B6472]">{deliveryCostCopy(deliveryType)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
                Beneficio activo
              </span>
              <span className="max-w-[220px] text-right text-sm font-bold text-[#047857]">
                {activeBenefit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C8798]">
                Pago
              </span>
              <span className="text-sm font-bold text-slate-900">
                {paymentMethod ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined) : "Pendiente"}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] bg-[#172033] p-5 text-[#F8FAFC]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                  Total del pedido
                </p>
                <p className="mt-2 text-4xl font-black tracking-tight">{formatCurrency(total)}</p>
              </div>
              <StatusPill
                label={hasProducts ? "Listo para cierre" : "Agrega productos"}
                tone={hasProducts ? "warm" : "neutral"}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/72">
              {deliveryType === "domicilio"
                ? "El domicilio se coordina aparte si aplica. El total visible corresponde a tus productos."
                : `El pedido se registra para ${businessName} y queda listo para confirmacion.`}
            </p>
          </div>
        </div>

        <div className="rounded-[26px] border border-emerald-100 bg-emerald-50/90 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-slate-900">
                Confirmacion rapida por WhatsApp
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Tus datos se usan solo para gestionar la compra y coordinar la entrega o retiro.
              </p>
            </div>
          </div>
        </div>

        {submitError ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{submitError}</span>
            </div>
          </div>
        ) : null}

        <button
          data-testid="storefront-submit-order-button"
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting || productCount === 0}
          className="group flex w-full items-center justify-center gap-3 rounded-[28px] bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)] px-6 py-5 text-base font-black text-white shadow-[0_22px_46px_rgba(217,119,6,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_52px_rgba(217,119,6,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{isSubmitting ? "Enviando pedido..." : "Confirmar pedido"}</span>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
        <p className="text-center text-xs leading-5 text-[#7C8798]">Te tomara menos de 1 minuto.</p>
      </div>
    </section>
  );
}

function MobileFloatingCheckoutBar({
  total,
  productCount,
  nextStepCopy,
  ctaLabel,
  canSubmit,
  isSubmitting,
  onConfirm,
}: {
  total: number;
  productCount: number;
  nextStepCopy: string;
  ctaLabel: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E8DDD0] bg-[linear-gradient(180deg,rgba(252,248,243,0.96)_0%,rgba(255,253,249,0.98)_100%)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 shadow-[0_-18px_40px_rgba(23,32,51,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[26px] border border-[#E8DDD0] bg-[#FFFDF9]/96 p-3 shadow-[0_10px_30px_rgba(23,32,51,0.1)]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D97706]">
                Total actual
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {formatCurrency(total)}
              </p>
            </div>
            <StatusPill label={`${productCount} unidades`} tone={productCount > 0 ? "warm" : "neutral"} />
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#5B6472]">{nextStepCopy}</p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !canSubmit}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-[22px] bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)] px-4 py-4 text-sm font-black text-white shadow-[0_18px_36px_rgba(217,119,6,0.2)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{isSubmitting ? "Enviando pedido..." : ctaLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
  const [address, setAddress] = useState("");
  const [observations, setObservations] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [recentlyUpdatedProductId, setRecentlyUpdatedProductId] = useState<string | null>(null);
  const [recentlyAddedProductName, setRecentlyAddedProductName] = useState("");

  const deferredProductQuery = useDeferredValue(productQuery);
  const hasValidWhatsApp = isValidWhatsAppPhone(customerPhone);
  const showAddressField = deliveryType === "domicilio";
  const availablePaymentMethods = useMemo(
    () => getAvailablePaymentMethods(deliveryType, business.availablePaymentMethods),
    [business.availablePaymentMethods, deliveryType],
  );
  const selected = useMemo(() => selectedProducts(business, quantities), [business, quantities]);
  const total = useMemo(
    () =>
      business.products.reduce(
        (sum, product) => sum + (quantities[product.productId] ?? 0) * product.price,
        0,
      ),
    [business.products, quantities],
  );
  const productCount = countProducts(quantities);
  const featuredProducts = useMemo(() => {
    const flaggedProducts = business.products.filter((product) => product.isFeatured);
    return (flaggedProducts.length > 0 ? flaggedProducts : business.products).slice(0, 3);
  }, [business.products]);
  const filtered = useMemo(
    () => business.products.filter((product) => matchProduct(product, deferredProductQuery)),
    [business.products, deferredProductQuery],
  );
  const visibleProducts = deferredProductQuery.trim().length > 0 ? filtered : business.products;
  const visiblePaymentMethods = deliveryType ? availablePaymentMethods : [];
  const selectedFeaturedCount = business.products.filter(
    (product) => product.isFeatured && (quantities[product.productId] ?? 0) > 0,
  ).length;
  const customerReady = customerName.trim().length > 0 && hasValidWhatsApp;
  const productsReady = productCount > 0;
  const fulfillmentReady = Boolean(
    deliveryType && paymentMethod && (!showAddressField || address.trim().length > 0),
  );
  const confirmationReady = customerReady && productsReady && fulfillmentReady && privacyAccepted;
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
  const completedSteps = progressSteps.filter((step) => step.complete).length;
  const progressPercent = (completedSteps / progressSteps.length) * 100;
  const nextStepCopy = getCheckoutNudge({
    customerReady,
    productsReady,
    fulfillmentReady,
    privacyAccepted,
  });
  const activeBenefit = getActiveBenefit({
    deliveryType,
    paymentMethod,
    selectedFeaturedCount,
    productCount,
  });
  const mobileCtaLabel = getMobileCtaLabel({
    customerReady,
    productsReady,
    fulfillmentReady,
    privacyAccepted,
  });
  const heroBenefit =
    deliveryType === "recogida en tienda"
      ? "Retiro sin costo adicional"
      : deliveryType === "domicilio"
        ? "Entrega coordinada por WhatsApp"
        : "Confirmacion rapida por WhatsApp";

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

    if (deliveryType === "domicilio" && !address.trim()) {
      nextErrors.address = "La direccion es obligatoria para domicilio.";
    }

    if (!privacyAccepted) {
      nextErrors.privacyAccepted = "Debes autorizar el tratamiento de datos para enviar.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function selectDeliveryType(nextDeliveryType: DeliveryType) {
    setDeliveryType(nextDeliveryType);
    clearError("deliveryType");
    clearError("address");

    if (nextDeliveryType !== "domicilio") {
      setAddress("");
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
      <div className="mx-auto w-full max-w-7xl px-4 pb-44 pt-4 sm:px-6 sm:pb-28 sm:pt-8 lg:pb-28">
        <section className="relative overflow-hidden rounded-[32px] border border-[#E8DDD0] bg-[linear-gradient(135deg,#FFFDF9_0%,#FFF8EE_56%,#FFFDF9_100%)] px-4 py-4 shadow-[0_24px_70px_rgba(23,32,51,0.08)] sm:rounded-[40px] sm:px-6 sm:py-7">
          <div className="absolute -left-20 top-0 h-48 w-48 rounded-full bg-[#FDE7B1] blur-3xl" />
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#F6EFE6] blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br ${business.accent} shadow-[0_16px_36px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:h-14 sm:w-14 sm:rounded-[22px]`}
                >
                  <Store className="h-5 w-5 text-slate-800 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#D97706]">
                    {business.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#5B6472] sm:text-sm sm:leading-6">
                    {resolveStorefrontSubline(business.tagline)}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-w-3xl sm:mt-6">
                <h1 className="text-[2rem] font-black tracking-tight text-slate-900 sm:text-4xl lg:text-[3rem] lg:leading-[1.05]">
                  Pide en menos de 1 minuto
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#5B6472] sm:mt-3 sm:text-base sm:leading-7">
                  Se siente como una compra guiada: eliges productos, defines entrega y pago, y
                  confirmas con claridad desde el mismo lugar.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                <StatusPill
                  label={heroBenefit}
                  tone="warm"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Resumen sticky"
                  tone="neutral"
                  icon={<ShoppingBag className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Compra confiable"
                  tone="success"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                />
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:hidden">
                <a
                  href="#storefront-products-section"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#172033] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_28px_rgba(23,32,51,0.14)]"
                >
                  Ir a productos
                  <ChevronRight className="h-4 w-4" />
                </a>
                <StatusPill label="4 pasos claros" tone="neutral" icon={<Clock3 className="h-3.5 w-3.5" />} />
                <StatusPill label="Cierre rapido" tone="success" icon={<Sparkles className="h-3.5 w-3.5" />} />
              </div>

              <div className="mt-6 hidden gap-3 sm:grid sm:grid-cols-3">
                <TrustChip
                  icon={Clock3}
                  label="Avance claro"
                  description="Ves el proceso dividido en pasos concretos y faciles de cerrar."
                />
                <TrustChip icon={Gift} label="Beneficio visible" description={activeBenefit} />
                <TrustChip
                  icon={CheckCircle2}
                  label="Sin vueltas"
                  description="Te pedimos solo la informacion necesaria para operar el pedido."
                />
              </div>
            </div>

            <ProgressOverview steps={progressSteps} progressPercent={progressPercent} />
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] lg:items-start">
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
              description="Entre mas claro armes tu compra, mas rapido se siente el cierre."
              icon={ShoppingBag}
              complete={productsReady}
              highlight
              status={
                <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                  <StatusPill label={`${productCount} unidades`} tone={productsReady ? "warm" : "neutral"} />
                  <StatusPill
                    label={`${selected.length} producto(s)`}
                    tone={productsReady ? "success" : "neutral"}
                  />
                </div>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 rounded-[30px] border border-[#E8DDD0] bg-[#FFFDF9]/92 p-4 shadow-[0_14px_34px_rgba(23,32,51,0.08)] lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#D97706]">
                      Productos protagonistas
                    </p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                      Elige desde lo que mas mueve el negocio
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#5B6472]">
                      Entre mas agregas, mejor aprovechas tu compra. Todo lo que sumes impacta el
                      total de inmediato.
                    </p>

                    <div className="mt-4 flex flex-col gap-3">
                      {featuredProducts.map((product) => (
                        <ProductCard
                          key={`featured-${product.productId}`}
                          product={product}
                          quantity={quantities[product.productId] ?? 0}
                          onDecrease={() => updateQuantity(product.productId, -1)}
                          onIncrease={() => updateQuantity(product.productId, 1)}
                          compact
                          recentlyUpdated={recentlyUpdatedProductId === product.productId}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="rounded-[26px] bg-[linear-gradient(180deg,#FFF3D6_0%,#FFFDF9_100%)] p-4 ring-1 ring-[#F3D39A]">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B45309]">
                        Beneficio visible
                      </p>
                      <p className="mt-2 text-sm font-black tracking-tight text-slate-900">
                        {activeBenefit}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#5B6472]">
                        El resumen de la derecha te muestra en todo momento cuanto llevas y que te
                        falta para confirmar.
                      </p>
                    </div>

                    <div
                      aria-live="polite"
                      className={`rounded-[26px] border p-4 transition-all ${
                        recentlyAddedProductName
                          ? "border-[#A7F3D0] bg-[#EAFBF4]"
                          : "border-[#E8DDD0] bg-[#F6EFE6]/65"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7C8798]">
                        Feedback inmediato
                      </p>
                      <p className="mt-2 text-sm font-black tracking-tight text-slate-900">
                        {recentlyAddedProductName
                          ? `${recentlyAddedProductName} se agrego a tu pedido`
                          : "Cada producto que sumas actualiza el resumen en vivo"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#5B6472]">
                        {recentlyAddedProductName
                          ? "Sigue armando tu compra o pasa directo a entrega y pago."
                          : "La idea es que comprar se sienta guiado, no como llenar una tabla fria."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCatalogOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:border-[#D8C8B5] hover:shadow-md active:scale-[0.98]"
                    >
                      Ver catalogo completo
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[30px] border border-[#E8DDD0] bg-[#FFFDF9]/92 p-4 shadow-[0_10px_28px_rgba(23,32,51,0.06)] sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="Busca por nombre o descripcion"
                      className="w-full rounded-[24px] border border-[#E8DDD0] bg-[#F6EFE6]/65 py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:border-[#F59E0B] focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-[#FFF3D6] px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#B45309] ring-1 ring-[#F3D39A]">
                    <span>{business.products.length} productos</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                    <span>Catalogo vivo</span>
                  </div>
                </div>

                {errors.products ? (
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>{errors.products}</span>
                    </div>
                  </div>
                ) : null}

                <div
                  data-testid="storefront-inline-products"
                  className="flex flex-col gap-4"
                >
                  {visibleProducts.length > 0 ? (
                    visibleProducts.map((product) => (
                      <ProductCard
                        key={product.productId}
                        product={product}
                        quantity={quantities[product.productId] ?? 0}
                        onDecrease={() => updateQuantity(product.productId, -1)}
                        onIncrease={() => updateQuantity(product.productId, 1)}
                        recentlyUpdated={recentlyUpdatedProductId === product.productId}
                      />
                    ))
                  ) : (
                    <div className="rounded-[30px] border-2 border-dashed border-[#E8DDD0] bg-[#FFFDF9]/90 px-6 py-12 text-center sm:col-span-2 xl:col-span-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF3D6] text-[#D97706] ring-1 ring-[#F3D39A]">
                        <Search className="h-6 w-6" />
                      </div>
                      <p className="mt-4 text-sm font-black text-slate-900">No hay resultados</p>
                      <p className="mt-2 text-sm leading-6 text-[#7C8798]">
                        Prueba otra busqueda o abre el catalogo completo para seguir sumando.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </SectionFrame>
            <SectionFrame
              step="Paso 3"
              title="Entrega y pago"
              description="Primero decides como lo recibes y despues ves solo los pagos compatibles con esa eleccion."
              icon={Truck}
              complete={fulfillmentReady}
              status={
                fulfillmentReady ? (
                  <StatusPill
                    label="Ruta definida"
                    tone="success"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  />
                ) : (
                  <StatusPill label="Falta completar" tone="warm" icon={<Truck className="h-3.5 w-3.5" />} />
                )
              }
            >
              <div className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:rounded-[30px] sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          Entrega
                        </p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">
                          Como quieres recibirlo?
                        </h3>
                      </div>
                      <StatusPill label={deliveryType ? "Elegida" : "Pendiente"} tone={deliveryType ? "success" : "neutral"} />
                    </div>

                    <div className="mt-4 grid gap-3">
                      {business.availableDeliveryTypes.map((type) => (
                        <ChoiceCard
                          key={type}
                          title={deliveryTitle(type)}
                          description={deliveryDescription(type)}
                          supporting={deliverySupport(type)}
                          badge={deliveryBadge(type)}
                          icon={Truck}
                          selected={deliveryType === type}
                          onClick={() => selectDeliveryType(type)}
                          testId={`storefront-delivery-option-${slugifyChoice(type)}`}
                          value={type}
                        />
                      ))}
                    </div>
                    <Err message={errors.deliveryType} />

                    {showAddressField ? (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="space-y-2">
                          <span className="text-sm font-black tracking-tight text-slate-900">
                            Direccion de entrega
                          </span>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" />
                            <textarea
                              rows={3}
                              data-testid="storefront-delivery-address-input"
                              value={address}
                              onChange={(event) => {
                                setAddress(event.target.value);
                                clearError("address");
                              }}
                              placeholder="Calle, numero, barrio o indicaciones"
                              className={`w-full rounded-[24px] border bg-[#F6EFE6]/65 py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6] ${
                                errors.address
                                  ? "border-rose-200 focus:border-rose-400"
                                  : "border-[#E8DDD0] focus:border-[#F59E0B]"
                              }`}
                            />
                          </div>
                          <Err message={errors.address} />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:rounded-[30px] sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          Pago
                        </p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">
                          Como quieres pagarlo?
                        </h3>
                      </div>
                      <StatusPill label={paymentMethod ? "Elegido" : "Pendiente"} tone={paymentMethod ? "success" : "neutral"} />
                    </div>

                    <div className="mt-4">
                      {deliveryType ? (
                        visiblePaymentMethods.length > 0 ? (
                          <div className="grid gap-3">
                            {visiblePaymentMethods.map((method) => (
                              <ChoiceCard
                                key={method}
                                title={getPaymentMethodLabel(method, deliveryType || undefined)}
                                description={paymentHint(method, deliveryType)}
                                supporting={
                                  method === "Transferencia"
                                    ? "Acelera la confirmacion del pedido."
                                    : method === "Contra entrega"
                                      ? "Disponible segun la entrega elegida."
                                      : method === "Tarjeta"
                                        ? "Solo aparece si el negocio la tiene habilitada."
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
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-[#E8DDD0] bg-[#F6EFE6]/65 p-5">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#FFFDF9] text-[#D97706] ring-1 ring-[#E8DDD0]">
                                <Info className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900">
                                  No hay pagos publicos compatibles con esta entrega.
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  El negocio necesita habilitar un metodo valido para este carril.
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                          <div className="rounded-[24px] border border-dashed border-[#E8DDD0] bg-[#F6EFE6]/65 p-5">
                            <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#FFFDF9] text-[#D97706] ring-1 ring-[#E8DDD0]">
                              <Info className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">
                                Elige primero la entrega
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                Asi solo muestras opciones reales y compatibles con el pedido.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Err message={errors.paymentMethod} />
                  </div>
                </div>
              </div>
            </SectionFrame>
            <SectionFrame
              step="Paso 4"
              title="Confirmacion"
              description="Ajusta una nota final si hace falta y deja clara la autorizacion de datos antes de cerrar."
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
                  <StatusPill label="Ultimos detalles" tone="warm" icon={<Shield className="h-3.5 w-3.5" />} />
                )
              }
            >
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:rounded-[30px] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        Observaciones
                      </p>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">
                        Quieres agregar algo?
                      </h3>
                    </div>
                    <StatusPill label="Opcional" tone="neutral" />
                  </div>

                  <label className="mt-4 block">
                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-400" />
                      <textarea
                        rows={5}
                        data-testid="storefront-order-notes-input"
                        value={observations}
                        onChange={(event) => setObservations(event.target.value)}
                        placeholder="Ej: sin salsa, llamar al llegar, entregar en porteria..."
                        className="w-full rounded-[24px] border border-[#E8DDD0] bg-[#F6EFE6]/65 py-4 pl-12 pr-4 text-base font-medium text-slate-900 outline-none transition-all focus:border-[#F59E0B] focus:bg-[#FFFDF9] focus:ring-4 focus:ring-[#FFF3D6]"
                      />
                    </div>
                  </label>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:rounded-[30px] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        Autorizacion de datos
                      </p>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">
                        Compra clara y transparente
                      </h3>
                    </div>
                    <StatusPill label={privacyAccepted ? "Aceptada" : "Pendiente"} tone={privacyAccepted ? "success" : "neutral"} />
                  </div>

                  <div
                    className={`mt-4 rounded-[28px] border p-4 transition-all ${
                      privacyAccepted
                        ? "border-[#A7F3D0] bg-[#EAFBF4]"
                        : "border-[#E8DDD0] bg-[#F6EFE6]/65"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#FFFDF9] text-slate-900 shadow-sm ring-1 ring-[#E8DDD0]">
                        <Shield className="h-5 w-5" />
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
                              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-emerald-600 checked:bg-emerald-600"
                            />
                            <CheckCircle2 className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900">
                              Autorizo el tratamiento de mis datos para gestionar este pedido y contactarme sobre su entrega.
                            </p>
                            <p className="text-sm leading-6 text-slate-600">
                              Tus datos se usan solo para procesar tu compra.
                            </p>
                          </div>
                        </label>

                        <p className="mt-4 text-xs leading-5 text-slate-600">
                          Puedes revisar la{" "}
                          <Link
                            href="/legal/privacidad"
                            className="font-black text-[#B45309] underline decoration-2 underline-offset-4"
                          >
                            politica de tratamiento
                          </Link>{" "}
                          antes de confirmar.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Err message={errors.privacyAccepted} />
                </div>
              </div>
            </SectionFrame>
          </div>

          <aside className="lg:sticky lg:top-6">
            <SummaryPanel
              businessName={business.name}
              total={total}
              deliveryType={deliveryType}
              paymentMethod={paymentMethod}
              selectedProducts={selected}
              productCount={productCount}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onConfirm={() => void handleConfirmOrder()}
              progressPercent={progressPercent}
              completedSteps={completedSteps}
              nextStepCopy={nextStepCopy}
              activeBenefit={activeBenefit}
            />
          </aside>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-[#0F172A]/35 transition duration-200 ${
          isCatalogOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsCatalogOpen(false)}
      />

      <aside
        className={`fixed bottom-0 right-0 top-auto z-50 flex h-[84vh] w-full flex-col rounded-t-[32px] border border-[#E8DDD0] bg-[linear-gradient(180deg,#FCF8F3_0%,#FFFDF9_100%)] shadow-[0_-18px_45px_rgba(23,32,51,0.18)] transition-transform duration-300 sm:top-0 sm:h-screen sm:max-w-md sm:rounded-none sm:rounded-l-[32px] sm:border-l ${
          isCatalogOpen
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
        aria-hidden={!isCatalogOpen}
      >
        <div className="border-b border-[#E8DDD0] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D97706]">
                Catalogo completo
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">
                Sigue armando tu pedido
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Ajusta cantidades sin salir del checkout.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className="rounded-full border border-[#E8DDD0] bg-[#FFFDF9] px-4 py-2 text-sm font-black text-[#5B6472] transition hover:border-[#D8C8B5] hover:bg-[#F6EFE6]"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 rounded-[24px] bg-[#172033] px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
                  Total actual
                </p>
                <p className="mt-1 text-xl font-black">{formatCurrency(total)}</p>
              </div>
              <StatusPill label={`${productCount} unidades`} tone="warm" />
            </div>
          </div>

          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Buscar en todo el catalogo"
              className="w-full rounded-[24px] border border-[#E8DDD0] bg-[#FFFDF9] py-3.5 pl-11 pr-4 text-base leading-6 text-slate-900 outline-none transition focus:border-[#F59E0B] focus:ring-4 focus:ring-[#FFF3D6] sm:text-sm sm:leading-5"
            />
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {filtered.length > 0 ? (
            filtered.map((product) => (
              <ProductCard
                key={`drawer-${product.productId}`}
                product={product}
                quantity={quantities[product.productId] ?? 0}
                onDecrease={() => updateQuantity(product.productId, -1)}
                onIncrease={() => updateQuantity(product.productId, 1)}
                recentlyUpdated={recentlyUpdatedProductId === product.productId}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#E8DDD0] bg-[#FFFDF9] px-4 py-5 text-sm text-[#7C8798]">
              No encontramos productos con esa busqueda.
            </div>
          )}
        </div>

        <div className="border-t border-[#E8DDD0] px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={() => setIsCatalogOpen(false)}
            className="w-full rounded-full bg-[#172033] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0F172A]"
          >
            Confirmar y volver al formulario
          </button>
        </div>
      </aside>

      <MobileFloatingCheckoutBar
        total={total}
        productCount={productCount}
        nextStepCopy={nextStepCopy}
        ctaLabel={mobileCtaLabel}
        canSubmit={productCount > 0}
        isSubmitting={isSubmitting}
        onConfirm={() => void handleConfirmOrder()}
      />
    </main>
  );
}
