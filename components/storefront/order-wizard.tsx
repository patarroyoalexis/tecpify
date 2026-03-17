"use client";

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getAvailablePaymentMethods,
  getPaymentMethodLabel,
  isDigitalPayment,
} from "@/components/dashboard/payment-helpers";
import {
  findCustomerProfileByWhatsApp,
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
} from "@/data/customer-profiles";
import { readOrdersForBusiness, writeOrdersForBusiness } from "@/data/order-storage";
import { createOrderViaApi } from "@/lib/orders/api";
import type { DeliveryType, Order, OrderProduct, PaymentMethod } from "@/types/orders";
import type { BusinessConfig, BusinessProduct } from "@/types/storefront";

interface IconProps {
  className?: string;
}

function IconBase({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

function UserIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M18 20a6 6 0 0 0-12 0" />
      <circle cx="12" cy="8" r="4" />
    </IconBase>
  );
}

function BagIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6 9h12l-1 10H7L6 9Z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </IconBase>
  );
}

function WalletIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8.5Z" />
      <path d="M16 12h5" />
      <circle cx="16" cy="12" r="1" />
    </IconBase>
  );
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M7 4h10v16l-2-1.5L13 20l-2-1.5L9 20l-2-1.5L5 20V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </IconBase>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6.5 4h3l1 4-2 1.5a14 14 0 0 0 6 6L16 13l4 1v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5 6.2 2 2 0 0 1 6.5 4Z" />
    </IconBase>
  );
}

function PinIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconBase>
  );
}

function NoteIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6 4h12a2 2 0 0 1 2 2v12l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6" />
      <path d="M9 12h6" />
    </IconBase>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </IconBase>
  );
}

function StoreIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4 10h16v9H4Z" />
      <path d="M5 10 7 5h10l2 5" />
      <path d="M9 19v-5h6v5" />
    </IconBase>
  );
}

function SuccessIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L15.5 10" />
    </IconBase>
  );
}

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

function getInitialStatus(paymentMethod: PaymentMethod) {
  return isDigitalPayment(paymentMethod) ? "pendiente de pago" : "confirmado";
}

function generateOrderId() {
  return `WEB-${Date.now().toString().slice(-6)}`;
}

function getProductCount(items: Record<string, number>) {
  return Object.values(items).reduce((total, quantity) => total + quantity, 0);
}

function getSelectedProducts(
  business: BusinessConfig,
  quantities: Record<string, number>,
): OrderProduct[] {
  return business.products
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => ({
      name: product.name,
      quantity: quantities[product.id],
    }));
}

function matchesProductQuery(product: BusinessProduct, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return `${product.name} ${product.description}`.toLowerCase().includes(normalizedQuery);
}

function CompactSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-slate-100 p-2.5 text-slate-500">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 sm:text-lg">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-rose-600">{message}</p>;
}

function ProductRow({
  product,
  quantity,
  onDecrease,
  onIncrease,
  compact = false,
}: {
  product: BusinessProduct;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  compact?: boolean;
}) {
  const active = quantity > 0;

  return (
    <article
      className={`rounded-[22px] border transition ${
        active
          ? "border-slate-900 bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${compact ? "p-3.5" : "p-4"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${active ? "text-white" : "text-slate-950"}`}>
            {product.name}
          </p>
          <p
            className={`mt-1 line-clamp-2 text-xs leading-5 ${
              active ? "text-white/75" : "text-slate-500"
            }`}
          >
            {product.description}
          </p>
          <p className={`mt-2 text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
            {formatCurrency(product.price)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrease}
            aria-label={`Restar ${product.name}`}
            className={`h-9 w-9 rounded-full border text-base font-semibold transition ${
              active
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            -
          </button>
          <span
            className={`min-w-8 text-center text-lg font-semibold ${
              active ? "text-white" : "text-slate-950"
            }`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrease}
            aria-label={`Sumar ${product.name}`}
            className={`h-9 w-9 rounded-full border text-base font-semibold transition ${
              active
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

export function StorefrontOrderWizard({
  business,
}: {
  business: BusinessConfig;
}) {
  const [confirmationMode, setConfirmationMode] = useState<"remote" | "local" | null>(null);
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
  const [submissionNotice, setSubmissionNotice] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [hasKnownProfile, setHasKnownProfile] = useState(false);
  const [customerLookupMessage, setCustomerLookupMessage] = useState("");
  const [revealedNamePhone, setRevealedNamePhone] = useState("");
  const lastHydratedPhoneRef = useRef("");

  const deferredProductQuery = useDeferredValue(productQuery);
  const hasValidWhatsApp = isValidWhatsAppPhone(customerPhone);
  const showNameField =
    hasValidWhatsApp || Boolean(customerName.trim()) || Boolean(errors.customerName);
  const showAddressField = deliveryType === "domicilio";

  const availablePaymentMethods = useMemo(() => {
    const allowedByDelivery = getAvailablePaymentMethods(deliveryType);
    return business.availablePaymentMethods.filter((method) =>
      allowedByDelivery.includes(method),
    );
  }, [business.availablePaymentMethods, deliveryType]);

  const selectedProducts = useMemo(
    () => getSelectedProducts(business, quantities),
    [business, quantities],
  );
  const total = useMemo(
    () =>
      business.products.reduce(
        (sum, product) => sum + (quantities[product.id] ?? 0) * product.price,
        0,
      ),
    [business.products, quantities],
  );

  const productCount = getProductCount(quantities);
  const featuredProducts =
    business.products.filter((product) => product.isFeatured).slice(0, 3).length > 0
      ? business.products.filter((product) => product.isFeatured).slice(0, 3)
      : business.products.slice(0, 3);
  const filteredProducts = useMemo(
    () =>
      business.products.filter((product) =>
        matchesProductQuery(product, deferredProductQuery),
      ),
    [business.products, deferredProductQuery],
  );
  const inlineProducts =
    deferredProductQuery.trim().length > 0 ? filteredProducts : featuredProducts;

  function syncCustomerProfile(nextPhone: string, nextDeliveryType: DeliveryType | "" = deliveryType) {
    const nextNormalizedPhone = normalizeWhatsAppPhone(nextPhone);

    if (!isValidWhatsAppPhone(nextPhone)) {
      setHasKnownProfile(false);
      setCustomerLookupMessage("");
      setRevealedNamePhone("");
      lastHydratedPhoneRef.current = "";
      return;
    }

    setRevealedNamePhone(nextNormalizedPhone);

    const profile = findCustomerProfileByWhatsApp(business.slug, nextPhone);

    if (!profile) {
      setHasKnownProfile(false);
      setCustomerLookupMessage("Es tu primera compra con este numero. Solo falta tu nombre.");

      if (lastHydratedPhoneRef.current !== nextNormalizedPhone) {
        setCustomerName("");
        if (nextDeliveryType === "domicilio") {
          setAddress("");
        }
      }

      lastHydratedPhoneRef.current = nextNormalizedPhone;
      return;
    }

    setHasKnownProfile(true);
    setCustomerLookupMessage("Encontramos tus datos y los dejamos listos para editar.");

    if (lastHydratedPhoneRef.current !== nextNormalizedPhone) {
      setCustomerName(profile.customerName);
      if (profile.address && nextDeliveryType === "domicilio") {
        setAddress(profile.address);
      }
      lastHydratedPhoneRef.current = nextNormalizedPhone;
      return;
    }

    if (profile.address && nextDeliveryType === "domicilio" && !address.trim()) {
      setAddress(profile.address);
    }
  }

  function clearFieldError(field: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
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

  function updateQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const currentValue = current[productId] ?? 0;
      const nextValue = Math.max(0, currentValue + delta);
      return { ...current, [productId]: nextValue };
    });
    clearFieldError("products");
  }

  async function handleConfirmOrder() {
    if (!validateAll() || !paymentMethod || !deliveryType) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmissionNotice("");
    setConfirmationMode(null);

    const createdAt = new Date().toISOString();
    const fallbackOrder: Order = {
      id: generateOrderId(),
      businessId: business.slug,
      client: customerName.trim(),
      customerPhone: customerPhone.trim(),
      products: selectedProducts,
      total,
      paymentMethod,
      paymentStatus: isDigitalPayment(paymentMethod) ? "pendiente" : "verificado",
      deliveryType,
      address: deliveryType === "domicilio" ? address.trim() : undefined,
      observations: observations.trim() || undefined,
      status: getInitialStatus(paymentMethod),
      createdAt,
      dateLabel: formatCreatedAt(createdAt),
      isReviewed: false,
      history: [
        {
          id: `${business.slug}-${createdAt}-created`,
          title: "Pedido creado desde formulario publico",
          description: "El cliente confirmo el pedido desde el enlace compartido del negocio.",
          occurredAt: createdAt,
        },
      ],
    };

    try {
      const persistedOrder = await createOrderViaApi({
        businessSlug: business.slug,
        customerName: customerName.trim(),
        customerWhatsApp: customerPhone.trim(),
        deliveryType,
        deliveryAddress: deliveryType === "domicilio" ? address.trim() : undefined,
        paymentMethod,
        notes: observations.trim() || undefined,
        total,
        status: getInitialStatus(paymentMethod),
        products: selectedProducts,
        paymentStatus: isDigitalPayment(paymentMethod) ? "pendiente" : "verificado",
        dateLabel: formatCreatedAt(createdAt),
        isReviewed: false,
        history: fallbackOrder.history,
      });

      try {
        const currentOrders = readOrdersForBusiness(business.slug) ?? [];
        writeOrdersForBusiness(business.slug, [persistedOrder, ...currentOrders]);
      } catch {
        // Keep a successful remote order even if local fallback storage is unavailable.
      }

      setConfirmationMode("remote");
      setConfirmedOrder(persistedOrder);
    } catch (remoteError) {
      console.error("[storefront] remote order persistence failed", remoteError);

      try {
        const currentOrders = readOrdersForBusiness(business.slug) ?? [];
        writeOrdersForBusiness(business.slug, [fallbackOrder, ...currentOrders]);
        setSubmissionNotice(
          "Pedido guardado temporalmente en este dispositivo. Aun no se sincroniza con la base de datos.",
        );
        setConfirmationMode("local");
        setConfirmedOrder(fallbackOrder);
      } catch {
        setSubmitError(
          remoteError instanceof Error
            ? remoteError.message
            : "No fue posible enviar tu pedido. Intenta de nuevo.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmedOrder) {
    const isRemoteConfirmation = confirmationMode === "remote";

    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
            <div className="flex justify-center">
              <div
                className={`rounded-full p-4 ${
                  isRemoteConfirmation
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                <SuccessIcon className="h-8 w-8" />
              </div>
            </div>
            <div className="mt-5 text-center">
              <p
                className={`text-sm font-semibold uppercase tracking-[0.24em] ${
                  isRemoteConfirmation ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {isRemoteConfirmation ? "Pedido confirmado" : "Guardado temporal"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                {isRemoteConfirmation
                  ? "Gracias por tu pedido"
                  : "Tu pedido quedo guardado solo en este dispositivo"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isRemoteConfirmation ? (
                  <>
                    Tu solicitud fue registrada para <strong>{business.name}</strong>.
                    Comparte este numero si necesitas soporte o seguimiento.
                  </>
                ) : (
                  <>
                    Aun no pudimos registrar tu solicitud en la base de datos de{" "}
                    <strong>{business.name}</strong>. Usa este numero solo como referencia
                    temporal hasta que se restablezca la sincronizacion.
                  </>
                )}
              </p>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              {submissionNotice ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {submissionNotice}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">Pedido</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                  {confirmedOrder.id}
                </span>
              </div>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-start justify-between gap-4">
                  <dt>Cliente</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {confirmedOrder.client}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>WhatsApp</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {confirmedOrder.customerPhone}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>Total</dt>
                  <dd className="text-right font-semibold text-slate-950">
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
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.14),transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/50 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-xl bg-gradient-to-r ${business.accent} p-2 text-slate-700`}>
                <StoreIcon className="h-4 w-4" />
              </span>
              <p className="truncate text-sm font-semibold text-slate-950">{business.name}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Completa tu pedido sin afanes</p>
          </div>

          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-right shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Total
            </p>
            <p className="text-sm font-semibold text-white">{formatCurrency(total)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-24 sm:px-6 sm:pt-28">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-4">
            <CompactSection
              title="Tus datos"
              description="Empieza con tu WhatsApp y te ayudamos a llenar lo repetido."
              icon={<UserIcon className="h-4 w-4" />}
            >
              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Celular con WhatsApp</span>
                  <div className="relative">
                    <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(event) => {
                        const nextPhone = event.target.value;
                        setCustomerPhone(nextPhone);
                        syncCustomerProfile(nextPhone);
                        clearFieldError("customerPhone");
                      }}
                      placeholder="300 123 4567"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:bg-white ${
                        errors.customerPhone
                          ? "border-rose-300 focus:border-rose-400"
                          : "border-slate-200 focus:border-slate-400"
                      }`}
                    />
                  </div>
                  <FieldError message={errors.customerPhone} />
                </label>

                <div
                  className={`grid transition-all duration-300 ${
                    showNameField ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <label className="space-y-2 pt-1">
                      <span className="text-sm font-medium text-slate-700">Nombre</span>
                      <div className="relative">
                        <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="customerName"
                          value={customerName}
                          onChange={(event) => {
                            setCustomerName(event.target.value);
                            clearFieldError("customerName");
                          }}
                          placeholder="Tu nombre o el de tu negocio"
                          autoComplete="name"
                          className={`w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:bg-white ${
                            errors.customerName
                              ? "border-rose-300 focus:border-rose-400"
                              : "border-slate-200 focus:border-slate-400"
                          }`}
                        />
                      </div>
                      <FieldError message={errors.customerName} />
                    </label>
                  </div>
                </div>

                {revealedNamePhone && customerLookupMessage ? (
                  <p
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      hasKnownProfile
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {customerLookupMessage}
                  </p>
                ) : null}
              </div>
            </CompactSection>

            <CompactSection
              title="Productos"
              description="Elige rapido tus productos y abre el catalogo completo solo cuando lo necesites."
              icon={<BagIcon className="h-4 w-4" />}
            >
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="relative block flex-1">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="Buscar producto"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(true)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Ver todos los productos
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <p className="text-slate-600">
                    {deferredProductQuery.trim()
                      ? `${filteredProducts.length} resultado${filteredProducts.length === 1 ? "" : "s"}`
                      : "3 destacados para pedir mas rapido"}
                  </p>
                  <p className="font-semibold text-slate-950">{formatCurrency(total)}</p>
                </div>

                {errors.products ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errors.products}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {inlineProducts.length > 0 ? (
                    inlineProducts.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        quantity={quantities[product.id] ?? 0}
                        onDecrease={() => updateQuantity(product.id, -1)}
                        onIncrease={() => updateQuantity(product.id, 1)}
                        compact
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      No encontramos productos con esa busqueda.
                    </div>
                  )}
                </div>
              </div>
            </CompactSection>

            <CompactSection
              title="Entrega y pago"
              description="Todo queda en la misma vista para terminar el pedido rapido."
              icon={<WalletIcon className="h-4 w-4" />}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Tipo de entrega</span>
                    <select
                      value={deliveryType}
                      onChange={(event) => {
                        const nextDeliveryType = event.target.value as DeliveryType | "";
                        setDeliveryType(nextDeliveryType);
                        if (nextDeliveryType !== "domicilio") {
                          setAddress("");
                        } else {
                          syncCustomerProfile(customerPhone, nextDeliveryType);
                        }
                        if (
                          paymentMethod &&
                          !business.availablePaymentMethods
                            .filter((method) =>
                              getAvailablePaymentMethods(nextDeliveryType).includes(method),
                            )
                            .includes(paymentMethod)
                        ) {
                          setPaymentMethod("");
                        }
                        clearFieldError("deliveryType");
                        clearFieldError("address");
                      }}
                      className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white ${
                        errors.deliveryType
                          ? "border-rose-300 focus:border-rose-400"
                          : "border-slate-200 focus:border-slate-400"
                      }`}
                    >
                      <option value="">Seleccionar</option>
                      {business.availableDeliveryTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.deliveryType} />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Metodo de pago</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) => {
                        setPaymentMethod(event.target.value as PaymentMethod | "");
                        clearFieldError("paymentMethod");
                      }}
                      className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white ${
                        errors.paymentMethod
                          ? "border-rose-300 focus:border-rose-400"
                          : "border-slate-200 focus:border-slate-400"
                      }`}
                    >
                      <option value="">Seleccionar</option>
                      {availablePaymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {getPaymentMethodLabel(method, deliveryType || undefined)}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.paymentMethod} />
                  </label>
                </div>

                <div
                  className={`grid transition-all duration-300 ${
                    showAddressField ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Direccion de entrega
                      </span>
                      <div className="relative">
                        <PinIcon className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
                        <textarea
                          rows={3}
                          value={address}
                          onChange={(event) => {
                            setAddress(event.target.value);
                            clearFieldError("address");
                          }}
                          placeholder="Calle, barrio, referencias o apartamento"
                          className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:bg-white ${
                            errors.address
                              ? "border-rose-300 focus:border-rose-400"
                              : "border-slate-200 focus:border-slate-400"
                          }`}
                        />
                      </div>
                      <FieldError message={errors.address} />
                    </label>
                  </div>
                </div>
              </div>
            </CompactSection>

            <CompactSection
              title="Observaciones"
              description="Opcional. Agrega solo lo necesario para entrega, pago o preparacion."
              icon={<NoteIcon className="h-4 w-4" />}
            >
              <label className="space-y-2">
                <span className="sr-only">Observaciones del pedido</span>
                <div className="relative">
                  <NoteIcon className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={3}
                    value={observations}
                    onChange={(event) => setObservations(event.target.value)}
                    placeholder="Indicaciones de entrega, referencias, detalles del pago o cualquier nota importante"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </div>
              </label>
            </CompactSection>

            <CompactSection
              title="Autorizacion de datos"
              description="Usaremos tus datos solo para procesar y dar seguimiento a este pedido."
              icon={<ReceiptIcon className="h-4 w-4" />}
            >
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => {
                      setPrivacyAccepted(event.target.checked);
                      clearFieldError("privacyAccepted");
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span className="text-sm leading-5 text-slate-700">
                    Autorizo el tratamiento de mis datos personales para gestionar este pedido y
                    contactarme por WhatsApp si hace falta.
                  </span>
                </label>
                <FieldError message={errors.privacyAccepted} />
              </div>
            </CompactSection>

            <div className="pb-8">
              {submitError ? (
                <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void handleConfirmOrder()}
                disabled={isSubmitting}
                className="w-full rounded-full bg-emerald-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isSubmitting ? "Enviando pedido..." : "Enviar pedido"}
              </button>
            </div>
          </div>

          <aside className="hidden lg:sticky lg:top-28 lg:block">
            <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                Resumen en vivo
              </p>
              <h2 className="mt-2 text-xl font-semibold">{business.name}</h2>
              <p className="mt-1 text-sm text-white/70">{business.tagline}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/65">Productos</span>
                  <span className="font-medium text-white">{productCount}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/65">Entrega</span>
                  <span className="font-medium capitalize text-white">
                    {deliveryType || "-"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/65">Pago</span>
                  <span className="max-w-[11rem] text-right font-medium text-white">
                    {paymentMethod
                      ? getPaymentMethodLabel(paymentMethod, deliveryType || undefined)
                      : "-"}
                  </span>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-sm text-white/65">Total</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(total)}</p>
                </div>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-white/80">
                {selectedProducts.length > 0 ? (
                  selectedProducts.map((product) => (
                    <li
                      key={product.name}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <span className="truncate">{product.name}</span>
                      <span className="font-semibold">x{product.quantity}</span>
                    </li>
                  ))
                ) : (
                  <li className="rounded-2xl border border-dashed border-white/15 px-3 py-4 text-white/55">
                    Aun no has agregado productos.
                  </li>
                )}
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition duration-200 ${
          isCatalogOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsCatalogOpen(false)}
      />
      <aside
        className={`fixed bottom-0 right-0 top-auto z-50 flex h-[82vh] w-full flex-col rounded-t-[28px] border border-slate-200 bg-white shadow-[0_-18px_45px_rgba(15,23,42,0.18)] transition-transform duration-300 sm:top-0 sm:h-screen sm:max-w-md sm:rounded-none sm:rounded-l-[28px] sm:border-l ${
          isCatalogOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
        aria-hidden={!isCatalogOpen}
      >
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Catalogo completo
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Todos los productos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ajusta cantidades sin salir del formulario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Total actual
              </p>
              <p className="text-base font-semibold">{formatCurrency(total)}</p>
            </div>
            <p className="text-sm text-white/75">{productCount} producto(s)</p>
          </div>

          <label className="relative mt-4 block">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Buscar en todo el catalogo"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductRow
                key={`drawer-${product.id}`}
                product={product}
                quantity={quantities[product.id] ?? 0}
                onDecrease={() => updateQuantity(product.id, -1)}
                onIncrease={() => updateQuantity(product.id, 1)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No encontramos productos con esa busqueda.
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={() => setIsCatalogOpen(false)}
            className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Confirmar y volver al formulario
          </button>
        </div>
      </aside>
    </main>
  );
}
