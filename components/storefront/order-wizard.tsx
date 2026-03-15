"use client";

import { useMemo, useState } from "react";

import {
  getAvailablePaymentMethods,
  getPaymentMethodLabel,
  isDigitalPayment,
} from "@/components/dashboard/payment-helpers";
import { writeOrdersForBusiness, readOrdersForBusiness } from "@/data/order-storage";
import type { DeliveryType, Order, OrderProduct, PaymentMethod } from "@/types/orders";
import type { BusinessConfig } from "@/types/storefront";

type WizardStep = 1 | 2 | 3 | 4;

interface StepDefinition {
  step: WizardStep;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface IconProps {
  className?: string;
}

function IconBase({
  children,
  className = "h-5 w-5",
}: {
  children: React.ReactNode;
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

export function StorefrontOrderWizard({
  business,
}: {
  business: BusinessConfig;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "">("");
  const [address, setAddress] = useState("");
  const [observations, setObservations] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

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

  const steps: StepDefinition[] = [
    {
      step: 1,
      title: "Datos del cliente",
      description: "Tus datos para confirmar el pedido.",
      icon: <UserIcon className="h-4 w-4" />,
    },
    {
      step: 2,
      title: "Seleccion de productos",
      description: "Elige cantidades y revisa tu subtotal.",
      icon: <BagIcon className="h-4 w-4" />,
    },
    {
      step: 3,
      title: "Pago y entrega",
      description: "Define como vas a pagar y recibir el pedido.",
      icon: <WalletIcon className="h-4 w-4" />,
    },
    {
      step: 4,
      title: "Resumen y confirmacion",
      description: "Revisa el pedido y confirma.",
      icon: <ReceiptIcon className="h-4 w-4" />,
    },
  ];

  function clearFieldError(field: string) {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateStep(targetStep: WizardStep) {
    const nextErrors: Record<string, string> = {};

    if (targetStep === 1) {
      if (!customerName.trim()) {
        nextErrors.customerName = "Escribe tu nombre para continuar.";
      }
      if (!customerPhone.trim()) {
        nextErrors.customerPhone = "Escribe tu celular con WhatsApp.";
      }
    }

    if (targetStep === 2 && productCount === 0) {
      nextErrors.products = "Agrega al menos un producto al pedido.";
    }

    if (targetStep === 3) {
      if (!deliveryType) {
        nextErrors.deliveryType = "Selecciona como quieres recibir el pedido.";
      }
      if (!paymentMethod) {
        nextErrors.paymentMethod = "Selecciona un metodo de pago.";
      }
      if (deliveryType === "domicilio" && !address.trim()) {
        nextErrors.address = "La direccion es obligatoria para domicilio.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goToNextStep() {
    if (!validateStep(step)) {
      return;
    }
    setStep((current) => Math.min(4, current + 1) as WizardStep);
  }

  function goToPreviousStep() {
    setStep((current) => Math.max(1, current - 1) as WizardStep);
  }

  function updateQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const currentValue = current[productId] ?? 0;
      const nextValue = Math.max(0, currentValue + delta);
      return { ...current, [productId]: nextValue };
    });
    clearFieldError("products");
  }

  function handleConfirmOrder() {
    const stepOneValid = validateStep(1);
    const stepTwoValid = validateStep(2);
    const stepThreeValid = validateStep(3);

    if (!stepOneValid || !stepTwoValid || !stepThreeValid || !paymentMethod || !deliveryType) {
      setStep(!stepOneValid ? 1 : !stepTwoValid ? 2 : 3);
      return;
    }

    const createdAt = new Date().toISOString();
    const newOrder: Order = {
      id: generateOrderId(),
      businessId: business.id,
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
          id: `${business.id}-${createdAt}-created`,
          title: "Pedido creado desde formulario publico",
          description: "El cliente confirmo el pedido desde el enlace compartido del negocio.",
          occurredAt: createdAt,
        },
      ],
    };

    try {
      const currentOrders = readOrdersForBusiness(business.id) ?? [];
      writeOrdersForBusiness(business.id, [newOrder, ...currentOrders]);
    } catch {
      // Keep the MVP resilient even if localStorage is unavailable.
    }

    setConfirmedOrder(newOrder);
  }

  if (confirmedOrder) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-100 p-4 text-emerald-700">
                <SuccessIcon className="h-8 w-8" />
              </div>
            </div>
            <div className="mt-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
                Pedido confirmado
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Gracias por tu pedido
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Tu solicitud fue registrada para <strong>{business.name}</strong>.
                Comparte este numero si necesitas soporte o seguimiento.
              </p>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <div className={`bg-gradient-to-r ${business.accent} px-5 py-6 sm:px-8`}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-white/80 p-3 text-slate-700 shadow-sm">
                <StoreIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600">
                  Pedido online
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                  {business.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                  {business.tagline}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Completa tu pedido en 4 pasos
                </p>
                <p className="text-xs text-slate-500">
                  Pensado para celular, rapido de llenar y facil de confirmar.
                </p>
              </div>
              <div className="text-sm font-semibold text-slate-500">
                Paso {step} de 4
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {steps.map((item) => {
                const isActive = item.step === step;
                const isCompleted = item.step < step;

                return (
                  <div
                    key={item.step}
                    className={`rounded-2xl border px-3 py-3 transition ${
                      isActive
                        ? "border-slate-900 bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
                        : isCompleted
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                    </div>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        isActive ? "text-white/75" : "text-inherit"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="animate-[tecpify-fade-up_.28s_ease]">
              {step === 1 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                      <UserIcon className="h-5 w-5 text-slate-400" />
                      Datos del cliente
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Comparte tus datos para confirmar el pedido por WhatsApp.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Nombre</span>
                      <div className="relative">
                        <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={customerName}
                          onChange={(event) => {
                            setCustomerName(event.target.value);
                            clearFieldError("customerName");
                          }}
                          placeholder="Tu nombre o el de tu negocio"
                          className={`w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:bg-white ${
                            errors.customerName
                              ? "border-rose-300 focus:border-rose-400"
                              : "border-slate-200 focus:border-slate-400"
                          }`}
                        />
                      </div>
                      {errors.customerName ? (
                        <p className="text-sm text-rose-600">{errors.customerName}</p>
                      ) : null}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Celular con WhatsApp
                      </span>
                      <div className="relative">
                        <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={customerPhone}
                          onChange={(event) => {
                            setCustomerPhone(event.target.value);
                            clearFieldError("customerPhone");
                          }}
                          placeholder="300 123 4567"
                          className={`w-full rounded-2xl border bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:bg-white ${
                            errors.customerPhone
                              ? "border-rose-300 focus:border-rose-400"
                              : "border-slate-200 focus:border-slate-400"
                          }`}
                        />
                      </div>
                      {errors.customerPhone ? (
                        <p className="text-sm text-rose-600">{errors.customerPhone}</p>
                      ) : null}
                    </label>
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                        <BagIcon className="h-5 w-5 text-slate-400" />
                        Selecciona tus productos
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Suma o resta cantidades segun lo que necesites.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-slate-500">Subtotal</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>

                  {errors.products ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {errors.products}
                    </div>
                  ) : null}

                  <div className="grid gap-4">
                    {business.products.map((product) => {
                      const quantity = quantities[product.id] ?? 0;

                      return (
                        <article
                          key={product.id}
                          className={`rounded-[28px] border p-5 transition ${
                            quantity > 0
                              ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p
                                className={`text-lg font-semibold ${
                                  quantity > 0 ? "text-white" : "text-slate-950"
                                }`}
                              >
                                {product.name}
                              </p>
                              <p
                                className={`text-sm leading-6 ${
                                  quantity > 0 ? "text-white/75" : "text-slate-600"
                                }`}
                              >
                                {product.description}
                              </p>
                              <p
                                className={`text-sm font-semibold ${
                                  quantity > 0 ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {formatCurrency(product.price)}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, -1)}
                                className={`h-11 w-11 rounded-full border text-lg font-semibold transition ${
                                  quantity > 0
                                    ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                -
                              </button>
                              <div className="min-w-12 text-center">
                                <p
                                  className={`text-2xl font-semibold ${
                                    quantity > 0 ? "text-white" : "text-slate-950"
                                  }`}
                                >
                                  {quantity}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, 1)}
                                className={`h-11 w-11 rounded-full border text-lg font-semibold transition ${
                                  quantity > 0
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
                    })}
                  </div>
                </section>
              ) : null}

              {step === 3 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                      <WalletIcon className="h-5 w-5 text-slate-400" />
                      Pago y entrega
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Elige la forma de pago, la entrega y deja observaciones si hace falta.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Tipo de entrega
                      </span>
                      <select
                        value={deliveryType}
                        onChange={(event) => {
                          const nextDeliveryType = event.target.value as DeliveryType | "";
                          setDeliveryType(nextDeliveryType);
                          if (nextDeliveryType !== "domicilio") {
                            setAddress("");
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
                      {errors.deliveryType ? (
                        <p className="text-sm text-rose-600">{errors.deliveryType}</p>
                      ) : null}
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Metodo de pago
                      </span>
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
                      {errors.paymentMethod ? (
                        <p className="text-sm text-rose-600">{errors.paymentMethod}</p>
                      ) : null}
                    </label>
                  </div>

                  <div
                    className={`grid overflow-hidden transition-all duration-300 ${
                      deliveryType === "domicilio"
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0">
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
                        {errors.address ? (
                          <p className="text-sm text-rose-600">{errors.address}</p>
                        ) : null}
                      </label>
                    </div>
                  </div>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Observaciones
                    </span>
                    <div className="relative">
                      <NoteIcon className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
                      <textarea
                        rows={5}
                        value={observations}
                        onChange={(event) => setObservations(event.target.value)}
                        placeholder="Indicaciones de entrega, referencias, detalles del pago o cualquier nota importante"
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </label>
                </section>
              ) : null}

              {step === 4 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
                      <ReceiptIcon className="h-5 w-5 text-slate-400" />
                      Revisa tu pedido
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Todo listo. Verifica la informacion antes de confirmar.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Pedido
                      </h3>
                      <ul className="mt-4 space-y-3">
                        {selectedProducts.map((product) => (
                          <li
                            key={product.name}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                          >
                            <span className="text-slate-700">{product.name}</span>
                            <span className="font-semibold text-slate-950">
                              x{product.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/60">
                        Resumen
                      </h3>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/65">Nombre</dt>
                          <dd className="text-right font-medium">{customerName}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/65">WhatsApp</dt>
                          <dd className="text-right font-medium">{customerPhone}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/65">Pago</dt>
                          <dd className="text-right font-medium">
                            {paymentMethod
                              ? getPaymentMethodLabel(
                                  paymentMethod,
                                  deliveryType || undefined,
                                )
                              : "-"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-white/65">Entrega</dt>
                          <dd className="text-right font-medium capitalize">
                            {deliveryType || "-"}
                          </dd>
                        </div>
                        {deliveryType === "domicilio" && address ? (
                          <div className="border-t border-white/10 pt-3">
                            <dt className="text-white/65">Direccion</dt>
                            <dd className="mt-1 text-right font-medium">{address}</dd>
                          </div>
                        ) : null}
                        {observations.trim() ? (
                          <div className="border-t border-white/10 pt-3">
                            <dt className="text-white/65">Observaciones</dt>
                            <dd className="mt-1 text-right font-medium">
                              {observations}
                            </dd>
                          </div>
                        ) : null}
                        <div className="border-t border-white/10 pt-3">
                          <dt className="text-white/65">Total</dt>
                          <dd className="mt-1 text-right text-xl font-semibold">
                            {formatCurrency(total)}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {step < 4
                  ? "Tus datos se usan solo para procesar este pedido."
                  : "Puedes volver a un paso anterior para ajustar cualquier detalle."}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Volver
                  </button>
                ) : null}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmOrder}
                    className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Confirmar pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
