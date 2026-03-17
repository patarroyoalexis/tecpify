"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  getCashPaymentDisplayStatus,
  getPaymentHelpMessage,
  getPaymentMethodLabel,
  isCashPayment,
  shouldShowPaymentVerificationActions,
} from "@/components/dashboard/payment-helpers";
import { formatCurrency } from "@/data/orders";
import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import {
  getOrderDisplayCode,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/types/orders";

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestPaymentProof: (orderId: string) => Promise<boolean>;
  onUpdatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
  onEditOrder: (
    orderId: string,
    payload: Pick<
      OrderApiUpdatePayload,
      | "status"
      | "paymentStatus"
      | "customerName"
      | "customerWhatsApp"
      | "deliveryAddress"
      | "notes"
      | "total"
    >,
  ) => Promise<Order>;
  onConfirmOrder: (orderId: string) => void;
  onAdvanceOrderStatus: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
}

type ToneClass = string;

interface IconProps {
  className?: string;
}

interface EditOrderFormState {
  customerName: string;
  customerWhatsApp: string;
  deliveryAddress: string;
  notes: string;
  total: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

const inPreparationStatus = ORDER_STATUSES[3];

function IconBase({
  children,
  className = "h-4 w-4",
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

function CustomerIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M18 20a6 6 0 0 0-12 0" />
      <circle cx="12" cy="8" r="4" />
    </IconBase>
  );
}

function PackageIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12 4 7.5" />
      <path d="M12 12l8-4.5" />
      <path d="M12 21v-9" />
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

function ClipboardIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4.5h6" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
    </IconBase>
  );
}

function MoneyIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7 10h.01" />
      <path d="M17 14h.01" />
    </IconBase>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </IconBase>
  );
}

function CardIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </IconBase>
  );
}

function DeliveryIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M3 7h11v8H3Z" />
      <path d="M14 10h3l3 3v2h-6" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
    </IconBase>
  );
}

const paymentToneStyles: Record<PaymentStatus, ToneClass> = {
  pendiente: "border border-slate-200 bg-slate-100 text-slate-700",
  verificado: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  "con novedad": "border border-orange-200 bg-orange-50 text-orange-800",
  "no verificado": "border border-rose-200 bg-rose-50 text-rose-800",
};

const orderToneStyles: Record<OrderStatus, ToneClass> = {
  "pendiente de pago": "border border-sky-200 bg-sky-50 text-sky-800",
  "pago por verificar": "border border-sky-200 bg-sky-50 text-sky-800",
  confirmado: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  [inPreparationStatus]: "border border-orange-200 bg-orange-50 text-orange-800",
  listo: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  entregado: "border border-green-200 bg-green-50 text-green-800",
  cancelado: "border border-rose-200 bg-rose-50 text-rose-800",
};

const historyFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getOrderDisplayStatus(order: Order): string {
  switch (order.status) {
    case "pendiente de pago":
    case "pago por verificar":
      return "Nuevo";
    case "confirmado":
      return "Confirmado";
    case inPreparationStatus:
      return "En preparacion";
    case "listo":
      return "Listo";
    case "entregado":
      return "Entregado";
    case "cancelado":
      return "Cancelado";
    default:
      return "Nuevo";
  }
}

function getPaymentDisplayStatus(order: Order): string {
  if (isCashPayment(order.paymentMethod)) {
    return getCashPaymentDisplayStatus(order);
  }

  switch (order.paymentStatus) {
    case "pendiente":
      return "Pendiente";
    case "verificado":
      return "Verificado";
    case "con novedad":
      return "Con novedad";
    case "no verificado":
      return "No verificado";
    default:
      return "Pendiente";
  }
}

function getOrderStatusBadgeLabel(order: Order) {
  return `Pedido · ${getOrderDisplayStatus(order)}`;
}

function getPaymentStatusBadgeLabel(order: Order) {
  return `Pago · ${getPaymentDisplayStatus(order)}`;
}

function getOrderStatusTone(order: Order): ToneClass {
  return orderToneStyles[order.status];
}

function getPaymentStatusTone(order: Order): ToneClass {
  if (isCashPayment(order.paymentMethod)) {
    return order.status === "entregado"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border border-amber-200 bg-amber-50 text-amber-800";
  }

  return paymentToneStyles[order.paymentStatus];
}

function getNextStepMessage(order: Order): string {
  if (isCashPayment(order.paymentMethod)) {
    if (order.status === "confirmado") {
      return "Pedido confirmado. Cobra al entregar o al momento de la recogida.";
    }

    if (order.status === inPreparationStatus) {
      return "Prepara el pedido. El cobro se realiza al recibirlo.";
    }

    if (order.status === "listo") {
      return "Pedido listo. Recuerda cobrar al entregarlo o recogerlo.";
    }

    if (order.status === "entregado") {
      return "Pedido entregado y pago recibido.";
    }
  }

  if (order.paymentStatus === "con novedad") {
    return "Hay una novedad en el pago. Revisala antes de continuar.";
  }

  if (order.paymentStatus !== "verificado") {
    return "Primero valida el pago para continuar.";
  }

  if (order.status === "pendiente de pago" || order.status === "pago por verificar") {
    return "Pago validado. Ya puedes confirmar el pedido.";
  }

  if (order.status === "confirmado") {
    return "Pedido confirmado. Continua con la preparacion.";
  }

  if (order.status === inPreparationStatus) {
    return "El pedido esta en preparacion. Actualiza cuando quede listo.";
  }

  if (order.status === "listo") {
    return "El pedido esta listo. Marca la entrega cuando corresponda.";
  }

  if (order.status === "entregado") {
    return "Pedido completado y entregado.";
  }

  return "El pedido esta cancelado.";
}

function getNextStepTone(order: Order): string {
  if (isCashPayment(order.paymentMethod)) {
    return order.status === "entregado"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border border-amber-200 bg-amber-50 text-amber-800";
  }

  if (order.paymentStatus === "verificado") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (order.paymentStatus === "con novedad") {
    return "border border-orange-200 bg-orange-50 text-orange-800";
  }

  if (order.paymentStatus === "no verificado") {
    return "border border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border border-amber-200 bg-amber-50 text-amber-800";
}

function getOrderItemsSummary(order: Order): string {
  if (order.products.length === 0) {
    return "Sin productos";
  }

  if (order.products.length === 1) {
    const [product] = order.products;
    return `${product.name} x${product.quantity}`;
  }

  const [firstProduct] = order.products;
  return `${firstProduct.name} x${firstProduct.quantity} +${order.products.length - 1} producto${order.products.length > 2 ? "s" : ""}`;
}

function getInitialEditOrderFormState(order: Order): EditOrderFormState {
  return {
    customerName: order.client,
    customerWhatsApp: order.customerPhone ?? "",
    deliveryAddress: order.address ?? "",
    notes: order.observations ?? "",
    total: String(order.total),
    status: order.status,
    paymentStatus: order.paymentStatus,
  };
}

function getEditValidationError(order: Order, formState: EditOrderFormState) {
  const customerName = formState.customerName.trim();
  const customerWhatsApp = formState.customerWhatsApp.trim();
  const deliveryAddress = formState.deliveryAddress.trim();
  const total = Number(formState.total);

  if (!customerName) {
    return "Ingresa el nombre del cliente.";
  }

  if (!customerWhatsApp) {
    return "Ingresa el telefono o WhatsApp del cliente.";
  }

  if (!ORDER_STATUSES.includes(formState.status)) {
    return "Selecciona un estado de pedido valido.";
  }

  if (!PAYMENT_STATUSES.includes(formState.paymentStatus)) {
    return "Selecciona un estado de pago valido.";
  }

  if (!Number.isFinite(total)) {
    return "Ingresa un total valido.";
  }

  if (total < 0) {
    return "El total no puede ser negativo.";
  }

  if (order.deliveryType === "domicilio" && !deliveryAddress) {
    return "La direccion es obligatoria para pedidos a domicilio.";
  }

  return "";
}

interface StatusBadgeProps {
  label: string;
  tone: ToneClass;
}

function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

interface SectionCardProps {
  title: string;
  description: string;
  statusLabel: string;
  statusTone: ToneClass;
  icon?: ReactNode;
  children: ReactNode;
}

function SectionCard({
  title,
  description,
  statusLabel,
  statusTone,
  icon,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-400">{icon}</span> : null}
            <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Estado
          </span>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function OrderDetailDrawer({
  order,
  isOpen,
  onClose,
  onRequestPaymentProof,
  onUpdatePaymentStatus,
  onEditOrder,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onCancelOrder,
}: OrderDetailDrawerProps) {
  const [whatsAppFeedback, setWhatsAppFeedback] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editForm, setEditForm] = useState<EditOrderFormState | null>(null);

  useEffect(() => {
    if (!order) {
      return;
    }

    setWhatsAppFeedback("");
    setIsEditing(false);
    setIsSaving(false);
    setEditError("");
    setEditSuccess("");
    setEditForm(getInitialEditOrderFormState(order));
  }, [order]);

  if (!order) {
    return null;
  }

  const currentOrder = order;
  const currentEditForm = editForm ?? getInitialEditOrderFormState(currentOrder);
  const sortedHistory = [...currentOrder.history].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
  const canConfirmOrder =
    currentOrder.paymentStatus === "verificado" &&
    (currentOrder.status === "pendiente de pago" ||
      currentOrder.status === "pago por verificar");
  const nextStatusAction: Partial<Record<OrderStatus, { buttonLabel: string }>> = {
    confirmado: { buttonLabel: "Marcar en preparacion" },
    [inPreparationStatus]: { buttonLabel: "Marcar como listo" },
    listo: { buttonLabel: "Marcar como entregado" },
  };
  const operationalAction = nextStatusAction[currentOrder.status] ?? null;
  const canCancelOrder = currentOrder.status !== "entregado";
  const orderStatusBadgeLabel = getOrderStatusBadgeLabel(currentOrder);
  const paymentStatusBadgeLabel = getPaymentStatusBadgeLabel(currentOrder);
  const orderTone = getOrderStatusTone(currentOrder);
  const paymentTone = getPaymentStatusTone(currentOrder);
  const nextStepMessage = getNextStepMessage(currentOrder);
  const nextStepTone = getNextStepTone(currentOrder);
  const orderItemsSummary = getOrderItemsSummary(currentOrder);
  const paymentHelpMessage = getPaymentHelpMessage(currentOrder);
  const showPaymentVerificationActions =
    shouldShowPaymentVerificationActions(currentOrder);
  const paymentVerified = currentOrder.paymentStatus === "verificado";
  const editValidationError = getEditValidationError(currentOrder, currentEditForm);
  const confirmHelpText = !paymentVerified
    ? "Primero valida el pago para continuar."
    : currentOrder.status === "confirmado" ||
        currentOrder.status === inPreparationStatus ||
        currentOrder.status === "listo" ||
        currentOrder.status === "entregado"
      ? "Este pedido ya avanzo en el flujo operativo."
      : currentOrder.status === "cancelado"
        ? "Un pedido cancelado no puede volver a confirmarse desde esta vista."
        : "El pedido esta listo para ser confirmado.";

  function handleEditFieldChange<K extends keyof EditOrderFormState>(
    field: K,
    value: EditOrderFormState[K],
  ) {
    setEditError("");
    setEditSuccess("");
    setEditForm((currentValue) => ({
      ...(currentValue ?? getInitialEditOrderFormState(currentOrder)),
      [field]: value,
    }));
  }

  function handleStartEditing() {
    setEditForm(getInitialEditOrderFormState(currentOrder));
    setEditError("");
    setEditSuccess("");
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setEditForm(getInitialEditOrderFormState(currentOrder));
    setEditError("");
    setEditSuccess("");
    setIsEditing(false);
  }

  async function handleCopyWhatsAppMessage() {
    const message = `Hola ${currentOrder.client}, por favor envianos el comprobante de pago del pedido ${getOrderDisplayCode(currentOrder)} para continuar con la validacion.`;

    try {
      await navigator.clipboard.writeText(message);
      await onRequestPaymentProof(currentOrder.id);
      setWhatsAppFeedback("Mensaje listo para enviar por WhatsApp.");
    } catch {
      setWhatsAppFeedback("No fue posible copiar el mensaje automaticamente.");
    }
  }

  async function handleSaveOrderChanges() {
    if (editValidationError) {
      setEditError(editValidationError);
      setEditSuccess("");
      return;
    }

    setIsSaving(true);
    setEditError("");
    setEditSuccess("");

    try {
      await onEditOrder(currentOrder.id, {
        customerName: currentEditForm.customerName.trim(),
        customerWhatsApp: currentEditForm.customerWhatsApp.trim(),
        deliveryAddress:
          currentOrder.deliveryType === "domicilio"
            ? currentEditForm.deliveryAddress.trim()
            : undefined,
        notes: currentEditForm.notes.trim() || null,
        total: Number(currentEditForm.total),
        status: currentEditForm.status,
        paymentStatus: currentEditForm.paymentStatus,
      });
      setEditSuccess("Cambios guardados correctamente.");
      setIsEditing(false);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "No fue posible guardar los cambios del pedido.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 transition ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={isSaving ? undefined : onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.15)] transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!isOpen}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 p-2 text-slate-500">
                  <CustomerIcon className="h-4 w-4" />
                </span>
                <h2 className="truncate text-2xl font-semibold text-slate-950">
                  {currentOrder.client}
                </h2>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Pedido {getOrderDisplayCode(currentOrder)}
                </span>
              </div>

              <div className="space-y-1 text-sm text-slate-600">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  <PackageIcon className="h-4 w-4 text-slate-400" />
                  <span>{orderItemsSummary}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {currentOrder.products.length} producto
                  {currentOrder.products.length > 1 ? "s" : ""} en este pedido
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={orderStatusBadgeLabel} tone={orderTone} />
                <StatusBadge label={paymentStatusBadgeLabel} tone={paymentTone} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <MoneyIcon className="h-3.5 w-3.5" />
                  <span className="font-semibold text-slate-700">Total:</span>{" "}
                  {formatCurrency(currentOrder.total)}
                </span>
                <span className="hidden text-slate-300 sm:inline">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {currentOrder.dateLabel}
                </span>
                <span className="hidden text-slate-300 sm:inline">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <CardIcon className="h-3.5 w-3.5" />
                  {getPaymentMethodLabel(
                    currentOrder.paymentMethod,
                    currentOrder.deliveryType,
                  )}
                </span>
                <span className="hidden text-slate-300 sm:inline">·</span>
                <span className="inline-flex items-center gap-1.5 capitalize">
                  <DeliveryIcon className="h-3.5 w-3.5" />
                  {currentOrder.deliveryType}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CustomerIcon className="h-5 w-5 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-950">
                    Cliente y datos operativos
                  </h3>
                </div>
                <p className="text-sm text-slate-600">
                  Edita el pedido desde aqui y guarda los cambios en tiempo real.
                </p>
              </div>

              {isEditing ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveOrderChanges()}
                    disabled={isSaving}
                    className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Editar pedido
                </button>
              )}
            </div>

            {editError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editError}
              </div>
            ) : null}

            {editSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {editSuccess}
              </div>
            ) : null}

            {isEditing ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Nombre del cliente</span>
                  <input
                    value={currentEditForm.customerName}
                    onChange={(event) => handleEditFieldChange("customerName", event.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Telefono / WhatsApp</span>
                  <input
                    value={currentEditForm.customerWhatsApp}
                    onChange={(event) =>
                      handleEditFieldChange("customerWhatsApp", event.target.value)
                    }
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Estado del pedido</span>
                  <select
                    value={currentEditForm.status}
                    onChange={(event) =>
                      handleEditFieldChange("status", event.target.value as OrderStatus)
                    }
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  >
                    {ORDER_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Estado del pago</span>
                  <select
                    value={currentEditForm.paymentStatus}
                    onChange={(event) =>
                      handleEditFieldChange(
                        "paymentStatus",
                        event.target.value as PaymentStatus,
                      )
                    }
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  >
                    {PAYMENT_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Total</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={currentEditForm.total}
                    onChange={(event) => handleEditFieldChange("total", event.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>

                {currentOrder.deliveryType === "domicilio" ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Direccion</span>
                    <input
                      value={currentEditForm.deliveryAddress}
                      onChange={(event) =>
                        handleEditFieldChange("deliveryAddress", event.target.value)
                      }
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Este pedido es para recogida en tienda, asi que no requiere direccion.
                  </div>
                )}

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Notas del pedido</span>
                  <textarea
                    rows={4}
                    value={currentEditForm.notes}
                    onChange={(event) => handleEditFieldChange("notes", event.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Cliente
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{currentOrder.client}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Telefono / WhatsApp
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {currentOrder.customerPhone ?? "Sin telefono registrado"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Direccion
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {currentOrder.deliveryType === "domicilio"
                      ? currentOrder.address ?? "Sin direccion registrada"
                      : "No aplica para recogida"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Notas
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {currentOrder.observations ?? "Sin notas registradas"}
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-950">Productos</h3>
            </div>
            <ul className="mt-4 space-y-3">
              {currentOrder.products.map((product) => (
                <li
                  key={`${currentOrder.id}-${product.name}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <span>{product.name}</span>
                  <span className="font-semibold text-slate-900">
                    {product.quantity} unidad{product.quantity > 1 ? "es" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-4">
            <SectionCard
              title="Pago"
              description={
                showPaymentVerificationActions
                  ? "Valida manualmente el comprobante antes de habilitar la confirmacion del pedido."
                  : "Este pago se gestiona al momento de la entrega o la recogida."
              }
              statusLabel={paymentStatusBadgeLabel}
              statusTone={paymentTone}
              icon={<WalletIcon className="h-5 w-5" />}
            >
              <ActionGroup>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <div className="flex items-start gap-2">
                    <WalletIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-sm text-slate-600">{paymentHelpMessage}</p>
                  </div>
                </div>

                {showPaymentVerificationActions ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyWhatsAppMessage}
                      disabled={isSaving}
                      className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Solicitar comprobante por WhatsApp
                    </button>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => onUpdatePaymentStatus(currentOrder.id, "verificado")}
                        disabled={isSaving}
                        className="w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Marcar pago como verificado
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePaymentStatus(currentOrder.id, "con novedad")}
                        disabled={isSaving}
                        className="w-full rounded-full border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Marcar pago con novedad
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePaymentStatus(currentOrder.id, "no verificado")
                        }
                        disabled={isSaving}
                        className="w-full rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                      >
                        Marcar pago como no verificado
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    No requiere comprobante ni validacion digital previa.
                  </div>
                )}

                {whatsAppFeedback ? (
                  <p className="text-sm text-slate-600">{whatsAppFeedback}</p>
                ) : null}
              </ActionGroup>
            </SectionCard>

            <div className="flex items-center gap-3 px-1">
              <span className="h-px flex-1 bg-slate-200" />
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <WalletIcon className="h-3.5 w-3.5" />
                Pago -&gt; Pedido
              </p>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <SectionCard
              title="Pedido"
              description="Gestiona el avance del pedido una vez el pago este validado."
              statusLabel={orderStatusBadgeLabel}
              statusTone={orderTone}
              icon={<ClipboardIcon className="h-5 w-5" />}
            >
              <ActionGroup>
                <div
                  className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${nextStepTone}`}
                >
                  <ClipboardIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{nextStepMessage}</span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <button
                    type="button"
                    onClick={() => onConfirmOrder(currentOrder.id)}
                    disabled={!canConfirmOrder || isSaving}
                    className={`w-full rounded-full px-4 py-3 text-sm font-medium transition ${
                      canConfirmOrder && !isSaving
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    Confirmar pedido
                  </button>
                  <p
                    className={`mt-3 text-sm ${
                      paymentVerified ? "text-slate-500" : "font-medium text-amber-700"
                    }`}
                  >
                    {confirmHelpText}
                  </p>
                </div>

                {operationalAction ? (
                  <button
                    type="button"
                    onClick={() => onAdvanceOrderStatus(currentOrder.id)}
                    disabled={isSaving}
                    className="w-full rounded-full border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {operationalAction.buttonLabel}
                  </button>
                ) : null}

                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                  <button
                    type="button"
                    onClick={() => onCancelOrder(currentOrder.id)}
                    disabled={!canCancelOrder || isSaving}
                    className={`w-full rounded-full px-4 py-3 text-sm font-medium transition ${
                      canCancelOrder && !isSaving
                        ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    Cancelar pedido
                  </button>
                  {!canCancelOrder ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Un pedido entregado ya no puede cancelarse.
                    </p>
                  ) : null}
                </div>
              </ActionGroup>
            </SectionCard>
          </div>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <ClipboardIcon className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-950">
                Historial del pedido
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Traza manual de eventos recientes para seguimiento operativo.
            </p>

            <div className="mt-4 space-y-4">
              {sortedHistory.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {event.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600">
                        {event.description}
                      </p>
                    </div>
                    <time className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {historyFormatter.format(new Date(event.occurredAt))}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
