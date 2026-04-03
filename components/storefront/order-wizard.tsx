"use client";

import { type ComponentType, type ReactNode, useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Info,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Store,
  Truck,
  User,
  MessageSquare,
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function slugifyChoice(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function countProducts(items: Record<string, number>) {
  return Object.values(items).reduce((sum, quantity) => sum + quantity, 0);
}

function selectedProducts(business: BusinessConfig, quantities: Record<string, number>): OrderProduct[] {
  return business.products
    .filter((product) => (quantities[product.productId] ?? 0) > 0)
    .map((product) => ({ productId: product.productId, name: product.name, quantity: quantities[product.productId], unitPrice: product.price }));
}

function matchProduct(product: BusinessProduct, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || `${product.name} ${product.description}`.toLowerCase().includes(normalized);
}

function deliveryTitle(type: DeliveryType) {
  return type === "domicilio" ? "Domicilio" : "Recogida en tienda";
}
function deliverySubtitle(type: DeliveryType) {
  return type === "domicilio" ? "Recibelo en tu direccion sin perder velocidad" : "Retira mas rapido si ya pasas por el negocio";
}
function deliveryBadge(type: DeliveryType) {
  return type === "domicilio" ? "Mas comodo" : "Mas rapido";
}
function paymentHint(method: PaymentMethod, deliveryType?: DeliveryType) {
  if (method === "Transferencia") return "Envias comprobante y sigues sin friccion";
  if (method === "Tarjeta") return "Pago inmediato si el negocio lo tiene disponible";
  if (method === "Contra entrega") return deliveryType === "domicilio" ? "Solo para domicilio, con pago al recibir" : "Disponible solo cuando la entrega es a domicilio";
  return "Cierre directo con efectivo al entregar o retirar";
}
function paymentBadge(method: PaymentMethod) {
  if (method === "Transferencia") return "Rapido";
  if (method === "Tarjeta") return "Inmediato";
  if (method === "Contra entrega") return "Solo domicilio";
  return "Clasico";
}

function Shell({ eyebrow, title, description, icon: Icon, children, badge, highlight = false }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  badge?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-[32px] border ${highlight ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,#ffffff_100%)] shadow-[0_16px_44px_rgba(251,146,60,0.12)]" : "border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.06)]"}`}>
      <div className={`flex items-start justify-between gap-4 border-b px-5 py-5 sm:px-6 ${highlight ? "border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))]" : "border-slate-200/70 bg-white"}`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_rgba(15,23,42,0.12)] ${highlight ? "bg-[linear-gradient(135deg,#ea580c_0%,#f59e0b_100%)]" : "bg-slate-950"}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        {badge}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Err({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rose-600"><Info className="h-3.5 w-3.5" /><span>{message}</span></div>;
}

function Pill({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${active ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />{label}</span>;
}

function OptionCard({ title, description, badge, icon: Icon, selected, onClick, testId, value }: {
  title: string;
  description: string;
  badge: string;
  icon: ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
  testId: string;
  value: string;
}) {
  return (
    <button type="button" data-testid={testId} data-choice-value={value} aria-pressed={selected} onClick={onClick} className={`group flex h-full w-full flex-col justify-between rounded-[24px] border p-4 text-left transition-all ${selected ? "border-amber-300 bg-[linear-gradient(180deg,rgba(255,247,237,0.95)_0%,#ffffff_100%)] shadow-[0_18px_36px_rgba(251,146,60,0.14)] ring-1 ring-amber-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.07)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-black tracking-tight text-slate-950">{title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-emerald-500 text-white" : "bg-slate-950 text-white group-hover:bg-amber-600"}`}><Icon className="h-5 w-5" /></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${selected ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"}`}>{badge}</span>{selected ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Seleccionado</span> : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">Elegir<ChevronRight className="h-3.5 w-3.5" /></span>}</div>
    </button>
  );
}

function ProductCard({ product, quantity, onDecrease, onIncrease, compact = false }: {
  product: BusinessProduct;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
}) {
  const active = quantity > 0;
  return (
    <article className={`group relative overflow-hidden rounded-[28px] border ${active ? "border-amber-300 bg-[linear-gradient(180deg,rgba(255,247,237,0.96)_0%,#ffffff_100%)] shadow-[0_18px_36px_rgba(251,146,60,0.16)] ring-1 ring-amber-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">{product.isFeatured ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-900 ring-1 ring-amber-200">Recomendado</span> : null}{active ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200">Agregado</span> : null}</div>
          <h3 className={`mt-2 font-black tracking-tight ${compact ? "text-base" : "text-lg"} text-slate-950`}>{product.name}</h3>
          <p className={`mt-2 line-clamp-2 leading-6 text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>{product.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2"><span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">{compact ? "Favorito" : "Precio"}</span><span className="text-2xl font-black tracking-tight text-slate-950">{formatCurrency(product.price)}</span></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-[20px] bg-slate-100/90 p-1">
          <button type="button" onClick={onDecrease} aria-label={`Restar ${product.name}`} className={`flex h-11 w-11 items-center justify-center rounded-[16px] border text-lg font-bold transition active:scale-95 ${active ? "border-white/20 bg-white text-slate-700 hover:bg-amber-50" : "border-slate-200 bg-white text-slate-400 hover:text-slate-950"}`}><Minus className="h-4 w-4" /></button>
          <span className="min-w-[42px] text-center text-lg font-black tabular-nums text-slate-950">{quantity}</span>
          <button type="button" onClick={onIncrease} aria-label={`Sumar ${product.name}`} className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-950 text-white text-lg font-bold transition hover:bg-amber-600 active:scale-95"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="text-right"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total linea</p><p className="mt-1 text-sm font-black text-slate-950">{quantity > 0 ? formatCurrency(product.price * quantity) : "Aun sin sumar"}</p></div>
      </div>
    </article>
  );
}

function SummaryPanel({ businessName, total, deliveryType, paymentMethod, selectedProducts, productCount, isSubmitting, submitError, onConfirm }: {
  businessName: string;
  total: number;
  deliveryType: DeliveryType | "";
  paymentMethod: PaymentMethod | "";
  selectedProducts: OrderProduct[];
  productCount: number;
  isSubmitting: boolean;
  submitError: string;
  onConfirm: () => void;
}) {
  const hasProducts = selectedProducts.length > 0;
  return (
    <section className="overflow-hidden rounded-[36px] border border-amber-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] shadow-[0_24px_68px_rgba(251,146,60,0.14)]">
      <div className="border-b border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Cierre en vivo</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">Tu pedido casi esta listo</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{hasProducts ? "Revisa el total, confirma los datos y envia el pedido sin pasos extras." : "Agrega productos para activar el cierre y ver el total final."}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_14px_28px_rgba(34,197,94,0.2)]"><CheckCircle2 className="h-5 w-5" /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill label="Datos" active />
          <Pill label="Productos" active={productCount > 0} />
          <Pill label="Entrega" active={Boolean(deliveryType)} />
          <Pill label="Pago" active={Boolean(paymentMethod)} />
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
          {hasProducts ? <div className="space-y-2">{selectedProducts.map((product) => { const unitPrice = product.unitPrice ?? 0; return <div key={product.productId} className="flex items-start justify-between gap-4 rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{product.name}</p><p className="text-[11px] font-medium text-slate-500">{product.quantity} x {formatCurrency(unitPrice)}</p></div><span className="text-sm font-black text-slate-950">{formatCurrency(unitPrice * product.quantity)}</span></div>; })}</div> : <div className="flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-amber-200 bg-amber-50/50 px-4 py-8 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm ring-1 ring-amber-100"><ShoppingBag className="h-6 w-6" /></div><p className="mt-3 text-sm font-black text-slate-950">Aun no agregas productos</p><p className="mt-1 text-xs leading-5 text-slate-500">El total y el CTA se activan apenas sumes el primer producto.</p></div>}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Subtotal</span><span className="tabular-nums text-sm font-bold text-slate-600">{formatCurrency(total)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Unidades</span><span className="text-sm font-bold text-slate-600">{productCount}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Entrega</span><span className="text-sm font-bold text-slate-950">{deliveryType ? deliveryTitle(deliveryType) : "Pendiente"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Pago</span><span className="text-sm font-bold text-slate-950">{paymentMethod ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined) : "Pendiente"}</span></div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Total a pagar</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{formatCurrency(total)}</p></div>
              <div className="rounded-2xl bg-amber-100 px-3 py-2 text-right"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-900">Estado</p><p className="mt-1 text-xs font-bold text-amber-900">{hasProducts ? "Listo para cerrar" : "Agrega productos"}</p></div>
            </div>
          </div>
        </div>

        {submitError ? <div className="flex items-start gap-3 rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"><Info className="mt-0.5 h-5 w-5 shrink-0" /><span>{submitError}</span></div> : null}

        <button data-testid="storefront-submit-order-button" type="button" onClick={onConfirm} disabled={isSubmitting || productCount === 0} className="group flex w-full items-center justify-center gap-3 rounded-[28px] bg-[linear-gradient(135deg,#ea580c_0%,#f59e0b_100%)] px-6 py-5 text-base font-black text-white shadow-[0_18px_42px_rgba(234,88,12,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(234,88,12,0.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"><span>{isSubmitting ? "Enviando pedido..." : "Enviar pedido ahora"}</span><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></button>
        <p className="text-xs leading-5 text-slate-500">El pedido se registra para <span className="font-bold text-slate-950">{businessName}</span> y queda listo para su operacion.</p>
      </div>
    </section>
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

  const deferredProductQuery = useDeferredValue(productQuery);
  const hasValidWhatsApp = isValidWhatsAppPhone(customerPhone);
  const showAddressField = deliveryType === "domicilio";
  const availablePaymentMethods = useMemo(() => getAvailablePaymentMethods(deliveryType, business.availablePaymentMethods), [business.availablePaymentMethods, deliveryType]);
  const selected = useMemo(() => selectedProducts(business, quantities), [business, quantities]);
  const total = useMemo(() => business.products.reduce((sum, product) => sum + (quantities[product.productId] ?? 0) * product.price, 0), [business.products, quantities]);
  const productCount = countProducts(quantities);
  const featured = useMemo(() => {
    const featuredProducts = business.products.filter((product) => product.isFeatured);
    return (featuredProducts.length > 0 ? featuredProducts : business.products).slice(0, 3);
  }, [business.products]);
  const filtered = useMemo(() => business.products.filter((product) => matchProduct(product, deferredProductQuery)), [business.products, deferredProductQuery]);
  const visibleProducts = deferredProductQuery.trim().length > 0 ? filtered : business.products;
  const visiblePaymentMethods = deliveryType ? availablePaymentMethods : [];

  function clearError(field: string) { setErrors((current) => { const next = { ...current }; delete next[field]; return next; }); }
  function updateQuantity(productId: string, delta: number) { setQuantities((current) => ({ ...current, [productId]: Math.max(0, (current[productId] ?? 0) + delta) })); clearError("products"); }

  function validateAll() {
    const nextErrors: Record<string, string> = {};
    if (!customerName.trim()) nextErrors.customerName = "Escribe tu nombre para continuar.";
    if (!customerPhone.trim()) nextErrors.customerPhone = "Escribe tu celular con WhatsApp."; else if (!hasValidWhatsApp) nextErrors.customerPhone = "Escribe un WhatsApp valido para continuar.";
    if (productCount === 0) nextErrors.products = "Agrega al menos un producto al pedido.";
    if (!deliveryType) nextErrors.deliveryType = "Selecciona como quieres recibir el pedido.";
    if (!paymentMethod) nextErrors.paymentMethod = "Selecciona un metodo de pago.";
    if (deliveryType === "domicilio" && !address.trim()) nextErrors.address = "La direccion es obligatoria para domicilio.";
    if (!privacyAccepted) nextErrors.privacyAccepted = "Debes autorizar el tratamiento de datos para enviar.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function selectDeliveryType(nextDeliveryType: DeliveryType) {
    setDeliveryType(nextDeliveryType); clearError("deliveryType"); clearError("address");
    if (nextDeliveryType !== "domicilio") setAddress("");
    if (paymentMethod && !getAvailablePaymentMethods(nextDeliveryType, business.availablePaymentMethods).includes(paymentMethod)) { setPaymentMethod(""); clearError("paymentMethod"); }
  }

  async function handleConfirmOrder() {
    if (!validateAll() || !paymentMethod || !deliveryType) return;
    setIsSubmitting(true); setSubmitError("");
    try {
      const persisted = await createStorefrontOrderViaApi({ businessSlug: business.businessSlug, customerName: customerName.trim(), customerWhatsApp: customerPhone.trim(), deliveryType, deliveryAddress: deliveryType === "domicilio" ? address.trim() : undefined, paymentMethod, notes: observations.trim() || undefined, total, products: selected });
      setConfirmedOrder(persisted);
    } catch (error) {
      debugError("[storefront] Remote order persistence failed", { businessSlug: business.businessSlug });
      setSubmitError(error instanceof Error ? error.message : "No fue posible enviar tu pedido. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.14),transparent_30%),linear-gradient(180deg,#fffdf8_0%,#fff7ed_46%,#f8fafc_100%)] px-4 py-6 sm:px-6" data-testid="storefront-order-confirmation">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-2xl items-center">
          <section className="w-full overflow-hidden rounded-[34px] border border-amber-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-6 sm:px-8">
              <div className="flex justify-center"><div className="rounded-full bg-emerald-100 p-4 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div></div>
              <div className="mt-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-600">Pedido confirmado</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Gracias por tu pedido</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">Tu solicitud quedo registrada para <strong>{business.name}</strong>. Guarda el numero del pedido para seguimiento y soporte.</p>
              </div>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Pedido</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">{getOrderDisplayCode(confirmedOrder)}</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Registrado</span>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start justify-between gap-4"><dt>Cliente</dt><dd className="text-right font-medium text-slate-950">{confirmedOrder.client}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt>WhatsApp</dt><dd className="text-right font-medium text-slate-950">{confirmedOrder.customerPhone}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt>Total</dt><dd className="text-right font-black text-slate-950">{formatCurrency(confirmedOrder.total)}</dd></div>
                    <div className="flex items-start justify-between gap-4"><dt>Creado</dt><dd className="text-right font-medium text-slate-950">{formatCreatedAt(confirmedOrder.createdAt)}</dd></div>
                  </dl>
                </div>
                <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Siguiente paso</p>
                  <p className="mt-2 text-lg font-black tracking-tight text-slate-950">El negocio ya puede tomar tu pedido.</p>
                  <div className="mt-4 rounded-[22px] border border-amber-100 bg-amber-50/70 p-4"><p className="text-sm font-bold text-slate-950">Cierre rapido</p><p className="mt-1 text-sm leading-6 text-slate-600">Si necesitan coordinar algo, usa el numero del pedido o responde desde el mismo canal operativo.</p></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.14),transparent_24%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.08),transparent_22%),linear-gradient(180deg,#fffdf8_0%,#fff7ed_42%,#f8fafc_100%)]" data-testid="storefront-order-wizard">
      <header className="sticky top-0 z-40 border-b border-white/80 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${business.accent} shadow-sm ring-1 ring-black/5`}><Store className="h-5 w-5 text-slate-800" /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-black text-slate-950 sm:text-base">{business.name}</h1>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-900 ring-1 ring-amber-200">Compra rapida</span>
                </div>
                <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{business.tagline || "Vitrina de compra clara, rapida y persuasiva"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end sm:flex"><span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total actual</span><span className="tabular-nums text-lg font-black tracking-tight text-slate-950">{formatCurrency(total)}</span></div>
              <div className="rounded-full bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white">Cierre guiado</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_380px] lg:items-start">
          <div className="space-y-6">
            <Shell eyebrow="Paso 1" title="Tus datos" description="Completa solo lo minimo para avanzar sin friccion y mantener el cierre rapido." icon={User} badge={hasValidWhatsApp ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 className="h-3 w-3" />Listo</span> : <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">Relleno rapido</span>}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2"><span className="text-sm font-bold tracking-tight text-slate-950">Celular con WhatsApp</span><div className="relative"><Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="customerPhone" data-testid="storefront-customer-phone-input" value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value); clearError("customerPhone"); }} placeholder="300 123 4567" inputMode="tel" autoComplete="tel" className={`w-full rounded-2xl border bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-amber-100 ${errors.customerPhone ? "border-rose-200 focus:border-rose-400" : "border-slate-200 focus:border-amber-400"}`}/></div><Err message={errors.customerPhone} /></label>
                <label className="space-y-2"><span className="text-sm font-bold tracking-tight text-slate-950">Nombre completo</span><div className="relative"><User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="customerName" data-testid="storefront-customer-name-input" value={customerName} onChange={(event) => { setCustomerName(event.target.value); clearError("customerName"); }} placeholder="Ej: Juan Perez" autoComplete="name" className={`w-full rounded-2xl border bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-amber-100 ${errors.customerName ? "border-rose-200 focus:border-rose-400" : "border-slate-200 focus:border-amber-400"}`}/></div><Err message={errors.customerName} /></label>
              </div>
            </Shell>

            <Shell eyebrow="Paso 2" title="Productos" description="Este es el bloque mas importante: explora, suma mas y ve el total crecer al instante." icon={ShoppingBag} highlight badge={<div className="flex flex-col items-end gap-2"><span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{productCount} unidades</span><span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{selected.length} productos elegidos</span></div>}>
              <div className="space-y-5">
                <div className="grid gap-3 rounded-[28px] border border-amber-100 bg-white/90 p-4 shadow-[0_8px_26px_rgba(251,146,60,0.08)] sm:grid-cols-[1fr_auto]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Destacados</p><h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Suma los productos que mas venden</h3></div><div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex"><CheckCircle2 className="h-3.5 w-3.5" />Aumenta ticket promedio</div></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {featured.map((product) => <ProductCard key={`spotlight-${product.productId}`} product={product} quantity={quantities[product.productId] ?? 0} onDecrease={() => updateQuantity(product.productId, -1)} onIncrease={() => updateQuantity(product.productId, 1)} compact />)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:w-[220px]">
                    <div className="rounded-[24px] bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] p-4 ring-1 ring-amber-100"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">Cierre rapido</p><p className="mt-2 text-sm font-bold text-slate-950">Agrega mas unidades para ver el total subir en vivo.</p><p className="mt-1 text-xs leading-5 text-slate-500">La seccion de productos es la que debe empujar la compra.</p></div>
                    <button type="button" onClick={() => setIsCatalogOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-amber-300 hover:shadow-md active:scale-[0.98]">Ver catalogo completo<ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center">
                  <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Que estas buscando?" className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100" /></div>
                  <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-900 ring-1 ring-amber-200"><span>{business.products.length} productos</span><span className="h-1 w-1 rounded-full bg-amber-500" /><span>Catalogo vivo</span></div>
                </div>

                {errors.products ? <div className="flex items-start gap-3 rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"><Info className="mt-0.5 h-5 w-5 shrink-0" /><span>{errors.products}</span></div> : null}

                <div data-testid="storefront-inline-products" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.length > 0 ? visibleProducts.map((product) => <ProductCard key={product.productId} product={product} quantity={quantities[product.productId] ?? 0} onDecrease={() => updateQuantity(product.productId, -1)} onIncrease={() => updateQuantity(product.productId, 1)} />) : <div className="sm:col-span-2 xl:col-span-3 rounded-[28px] border-2 border-dashed border-amber-200 bg-white/80 px-6 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100"><Search className="h-6 w-6" /></div><p className="mt-4 text-sm font-black text-slate-950">No hay resultados</p><p className="mt-1 text-sm leading-6 text-slate-500">Prueba otra busqueda o abre el catalogo completo para seguir sumando.</p></div>}
                </div>
              </div>
            </Shell>

            <Shell eyebrow="Paso 3" title="Entrega y pago" description="Primero eliges como recibes el pedido y luego aparece el pago compatible, en tarjetas claras." icon={Truck} badge={<span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{deliveryType ? "Decision tomada" : "Elegir entrega"}</span>}>
              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-black tracking-tight text-slate-950">Tipo de entrega</p><p className="text-xs font-medium text-slate-500">Selecciona una sola opcion visual</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {business.availableDeliveryTypes.map((type) => <OptionCard key={type} title={deliveryTitle(type)} description={deliverySubtitle(type)} badge={deliveryBadge(type)} icon={Truck} selected={deliveryType === type} onClick={() => selectDeliveryType(type)} testId={`storefront-delivery-option-${slugifyChoice(type)}`} value={type} />)}
                  </div>
                  <Err message={errors.deliveryType} />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-black tracking-tight text-slate-950">Metodo de pago</p><p className="text-xs font-medium text-slate-500">{deliveryType ? "Compatible con la entrega elegida" : "Se activa despues de elegir entrega"}</p></div>
                  {deliveryType ? <div className="grid gap-3 sm:grid-cols-2">{visiblePaymentMethods.map((method) => <OptionCard key={method} title={getPaymentMethodLabel(method, deliveryType || undefined)} description={paymentHint(method, deliveryType)} badge={paymentBadge(method)} icon={CreditCard} selected={paymentMethod === method} onClick={() => { setPaymentMethod(method); clearError("paymentMethod"); }} testId={`storefront-payment-option-${slugifyChoice(method)}`} value={method} />)}</div> : <div className="rounded-[24px] border border-dashed border-amber-200 bg-amber-50/70 p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 ring-1 ring-amber-100"><Info className="h-5 w-5" /></div><div><p className="text-sm font-black text-slate-950">Elige una entrega para ver los pagos disponibles.</p><p className="mt-1 text-sm leading-6 text-slate-500">Asi el flujo se mantiene claro y solo muestras opciones que realmente se pueden usar.</p></div></div></div>}
                  <Err message={errors.paymentMethod} />
                </div>

                {showAddressField ? <div className="animate-in fade-in slide-in-from-top-2 duration-300"><label className="space-y-2"><span className="text-sm font-bold tracking-tight text-slate-950">Direccion de entrega</span><div className="relative"><MapPin className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" /><textarea rows={2} data-testid="storefront-delivery-address-input" value={address} onChange={(event) => { setAddress(event.target.value); clearError("address"); }} placeholder="Calle, numero, barrio o indicaciones" className={`w-full rounded-2xl border bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-amber-100 ${errors.address ? "border-rose-200 focus:border-rose-400" : "border-slate-200 focus:border-amber-400"}`} /></div><Err message={errors.address} /></label></div> : null}
              </div>
            </Shell>

            <Shell eyebrow="Paso 4" title="Observaciones" description="Mantente breve aqui: agrega solo la nota util que ayude a operar mejor el pedido." icon={MessageSquare}>
              <div className="relative"><MessageSquare className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" /><textarea rows={3} data-testid="storefront-order-notes-input" value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Ej: El timbre no sirve, dejar en porteria, sin cebolla, etc." className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100" /></div>
            </Shell>

            <Shell eyebrow="Paso 5" title="Autorizacion de datos" description="Seria y clara, pero sin frenar el impulso de compra." icon={Shield}>
              <div className="space-y-4">
                <label className={`flex cursor-pointer items-start gap-4 rounded-[24px] border p-4 transition-all ${privacyAccepted ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-amber-200"}`}>
                  <div className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <input type="checkbox" data-testid="storefront-privacy-checkbox" checked={privacyAccepted} onChange={(event) => { setPrivacyAccepted(event.target.checked); clearError("privacyAccepted"); }} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 bg-white transition-all checked:border-emerald-600 checked:bg-emerald-600" />
                    <CheckCircle2 className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                  </div>
                  <div className="space-y-1"><p className="text-sm font-black text-slate-950">Acepto el tratamiento de mis datos para este pedido</p><p className="text-xs leading-relaxed text-slate-500">Entiendo que se usaran solo para gestionar este pedido y contactarme si hace falta.</p></div>
                </label>
                <Err message={errors.privacyAccepted} />
              </div>
            </Shell>
          </div>

          <aside className="lg:sticky lg:top-24">
            <SummaryPanel businessName={business.name} total={total} deliveryType={deliveryType} paymentMethod={paymentMethod} selectedProducts={selected} productCount={productCount} isSubmitting={isSubmitting} submitError={submitError} onConfirm={() => void handleConfirmOrder()} />
          </aside>
        </div>
      </div>

      <div className={`fixed inset-0 z-40 bg-slate-950/35 transition duration-200 ${isCatalogOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setIsCatalogOpen(false)} />
      <aside className={`fixed bottom-0 right-0 top-auto z-50 flex h-[84vh] w-full flex-col rounded-t-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] shadow-[0_-18px_45px_rgba(15,23,42,0.18)] transition-transform duration-300 sm:top-0 sm:h-screen sm:max-w-md sm:rounded-none sm:rounded-l-[30px] sm:border-l ${isCatalogOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"}`} aria-hidden={!isCatalogOpen}>
        <div className="border-b border-amber-100 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Catalogo completo</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Todos los productos</h2><p className="mt-1 text-sm leading-6 text-slate-500">Ajusta cantidades sin salir del formulario.</p></div>
            <button type="button" onClick={() => setIsCatalogOpen(false)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50">Cerrar</button>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[22px] bg-slate-950 px-4 py-3 text-white"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60">Total actual</p><p className="text-base font-black">{formatCurrency(total)}</p></div><p className="text-sm text-white/75">{productCount} unidad(es)</p></div>
          <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar en todo el catalogo" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base leading-6 text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100 sm:text-sm sm:leading-5" /></label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {filtered.length > 0 ? filtered.map((product) => <ProductCard key={`drawer-${product.productId}`} product={product} quantity={quantities[product.productId] ?? 0} onDecrease={() => updateQuantity(product.productId, -1)} onIncrease={() => updateQuantity(product.productId, 1)} />) : <div className="rounded-[24px] border border-dashed border-amber-200 bg-white px-4 py-5 text-sm text-slate-500">No encontramos productos con esa busqueda.</div>}
        </div>

        <div className="border-t border-amber-100 px-4 py-4 sm:px-5">
          <button type="button" onClick={() => setIsCatalogOpen(false)} className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600">Confirmar y volver al formulario</button>
        </div>
      </aside>
    </main>
  );
}
