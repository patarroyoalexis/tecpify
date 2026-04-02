"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getPaymentMethodLabel,
} from "@/components/dashboard/payment-helpers";
import { OrderPaymentReviewPanel } from "@/components/dashboard/order-payment-review-panel";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { StatusBadgeIcon } from "@/components/dashboard/status-badge-icon";
import { formatCurrency } from "@/data/orders";
import { canCancelOrder } from "@/lib/orders/action-semantics";
import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import {
  canOrderMoveFromNewToConfirmed,
  getOrderFinancialCondition,
  getOrderFinancialConditionVisuals,
  ORDER_FINANCIAL_CONDITION_LABELS,
  requiresManualPaymentReview,
} from "@/lib/orders/payment-gate";
import {
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
  getOrderStatusIconKey,
  getOrderStatusVisuals,
} from "@/lib/orders/status-system";
import { buildPaymentProofWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  getFiadoStatusLabel,
  getOrderDisplayCode,
  isPendingFiadoOrder,
  type Order,
  type PaymentStatus,
} from "@/types/orders";

interface OrderDetailDrawerProps {
  businessName: string;
  transferInstructions: string | null;
  allowsFiado: boolean;
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestPaymentProof: (orderId: Order["orderId"]) => Promise<boolean>;
  onUpdatePaymentStatus: (
    orderId: Order["orderId"],
    paymentStatus: PaymentStatus,
  ) => Promise<Order>;
  onEditOrder: (
    orderId: Order["orderId"],
    payload: Pick<
      OrderApiUpdatePayload,
      | "status"
      | "paymentStatus"
      | "customerName"
      | "customerWhatsApp"
      | "deliveryType"
      | "deliveryAddress"
      | "paymentMethod"
      | "products"
      | "notes"
      | "total"
      | "isFiado"
      | "fiadoStatus"
      | "fiadoObservation"
    >,
  ) => Promise<Order>;
  onConfirmOrder: (orderId: Order["orderId"]) => Promise<Order>;
  onAdvanceOrderStatus: (orderId: Order["orderId"]) => Promise<Order | undefined>;
  onOpenCancelOrderModal: (orderId: Order["orderId"]) => void;
  onOpenReactivateOrderModal: (orderId: Order["orderId"]) => void;
}

const historyFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getNextWorkflowStatus(order: Order) {
  if (order.status === "confirmado") {
    return "en preparación" as const;
  }

  if (order.status === "en preparación") {
    return "listo" as const;
  }

  if (order.status === "listo") {
    return "entregado" as const;
  }

  return null;
}

export function OrderDetailDrawer({
  businessName,
  transferInstructions,
  allowsFiado,
  order,
  isOpen,
  onClose,
  onRequestPaymentProof,
  onUpdatePaymentStatus,
  onEditOrder,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
}: OrderDetailDrawerProps) {
  const [actionError, setActionError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [fiadoObservationDraft, setFiadoObservationDraft] = useState(
    () => order?.fiadoObservation ?? "",
  );
  const [fiadoError, setFiadoError] = useState("");
  const [fiadoFeedback, setFiadoFeedback] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const sortedHistory = useMemo(() => {
    if (!order) {
      return [];
    }

    return [...order.history].sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
  }, [order]);

  if (!isOpen || !order) {
    return null;
  }

  const currentOrder = order;

  const statusVisuals = getOrderStatusVisuals(currentOrder.status);
  const financialCondition = getOrderFinancialCondition(currentOrder);
  const financialVisuals = getOrderFinancialConditionVisuals(financialCondition);
  const nextWorkflowStatus = getNextWorkflowStatus(currentOrder);
  const paymentMethodLabel = getPaymentMethodLabel(
    currentOrder.paymentMethod,
    currentOrder.deliveryType,
  );
  const isPendingFiado = isPendingFiadoOrder(currentOrder);
  const canCancel = canCancelOrder(currentOrder);
  const canConfirm =
    currentOrder.status === "nuevo" && canOrderMoveFromNewToConfirmed(currentOrder);
  const canAdvance = nextWorkflowStatus !== null;
  const canReactivate =
    currentOrder.status === "cancelado" &&
    currentOrder.previousStatusBeforeCancellation !== null;
  const requiresPaymentReview = requiresManualPaymentReview(currentOrder);
  const whatsappMessage = buildPaymentProofWhatsAppMessage({
    businessName,
    customerName: currentOrder.client,
    orderCode: currentOrder.orderCode ?? null,
    total: currentOrder.total,
    transferInstructions,
  });
  const whatsappUrl = buildWhatsAppUrl(currentOrder.customerPhone ?? "", whatsappMessage);

  async function runConfirmOrder() {
    setActionError("");
    setActionFeedback("");

    try {
      await onConfirmOrder(currentOrder.orderId);
      setActionFeedback("Pedido confirmado.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No fue posible confirmar el pedido.",
      );
    }
  }

  async function runAdvanceOrder() {
    setActionError("");
    setActionFeedback("");

    try {
      await onAdvanceOrderStatus(currentOrder.orderId);
      setActionFeedback("Pedido movido al siguiente estado.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No fue posible avanzar el pedido.",
      );
    }
  }

  async function runRequestPaymentProof() {
    setActionError("");
    setActionFeedback("");

    try {
      await onRequestPaymentProof(currentOrder.orderId);

      if (whatsappUrl) {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }

      setActionFeedback("Solicitud de comprobante preparada.");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No fue posible preparar la solicitud del comprobante.",
      );
    }
  }

  async function runMarkAsFiado() {
    const normalizedObservation = fiadoObservationDraft.trim();
    setFiadoError("");
    setFiadoFeedback("");

    if (normalizedObservation.length === 0) {
      setFiadoError("La nota de fiado es obligatoria.");
      return;
    }

    try {
      await onEditOrder(currentOrder.orderId, {
        isFiado: true,
        fiadoStatus: "pending",
        fiadoObservation: normalizedObservation,
      });
      setFiadoFeedback("Pedido marcado como fiado pendiente.");
    } catch (error) {
      setFiadoError(
        error instanceof Error ? error.message : "No fue posible marcar el pedido como fiado.",
      );
    }
  }

  async function runMarkFiadoAsPaid() {
    const normalizedObservation =
      fiadoObservationDraft.trim() || currentOrder.fiadoObservation?.trim() || "";
    setFiadoError("");
    setFiadoFeedback("");

    if (normalizedObservation.length === 0) {
      setFiadoError("La nota de fiado es obligatoria.");
      return;
    }

    try {
      await onEditOrder(currentOrder.orderId, {
        fiadoStatus: "paid",
        fiadoObservation: normalizedObservation,
      });
      setFiadoFeedback("Fiado marcado como pagado.");
    } catch (error) {
      setFiadoError(
        error instanceof Error ? error.message : "No fue posible marcar el fiado como pagado.",
      );
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/35"
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        data-testid="order-detail-drawer"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] shadow-[-18px_0_48px_rgba(15,23,42,0.14)]"
      >
        <header className="border-b border-slate-200 bg-white/92 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Detalle del pedido
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{order.client}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {getOrderDisplayCode(order)} · {order.dateLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <OrdersUiIcon icon="x" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCurrency(order.total)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {order.products.length} producto{order.products.length === 1 ? "" : "s"} ·{" "}
                  {paymentMethodLabel}
                </p>
                {order.customerPhone ? (
                  <p className="mt-1 text-sm text-slate-600">{order.customerPhone}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusVisuals.badgeClassName}`}
                >
                  <StatusBadgeIcon iconKey={getOrderStatusIconKey(order.status)} />
                  <span>{ORDER_STATUS_LABELS[order.status]}</span>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${financialVisuals.badgeClassName}`}
                >
                  <span>{ORDER_FINANCIAL_CONDITION_LABELS[financialCondition]}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Entrega
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {order.deliveryType === "domicilio" ? "Domicilio" : "Recogida en tienda"}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Pago
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">{paymentMethodLabel}</p>
              </div>
              {order.address ? (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Dirección
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{order.address}</p>
                </div>
              ) : null}
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Productos
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {order.products.map((product) => (
                    <span
                      key={`${product.name}-${product.quantity}-${product.productId ?? "custom"}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {product.quantity} x {product.name}
                    </span>
                  ))}
                </div>
              </div>
              {order.observations ? (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Notas
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{order.observations}</p>
                </div>
              ) : null}
              {order.status === "cancelado" ? (
                <div
                  className={`rounded-[20px] border px-4 py-3 sm:col-span-2 ${statusVisuals.softPanelClassName}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700/80">
                    Cancelación
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Motivo:{" "}
                    {order.cancellationReason
                      ? ORDER_CANCELLATION_REASON_LABELS[order.cancellationReason]
                      : "Sin motivo registrado"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Estado anterior:{" "}
                    {order.previousStatusBeforeCancellation
                      ? ORDER_STATUS_LABELS[order.previousStatusBeforeCancellation]
                      : "Sin estado anterior válido"}
                  </p>
                  {order.cancellationDetail ? (
                    <p className="mt-1 text-sm text-slate-700">{order.cancellationDetail}</p>
                  ) : null}
                </div>
              ) : null}
              {order.isFiado ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Fiado del negocio
                    </p>
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                      {getFiadoStatusLabel(order.fiadoStatus)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {order.fiadoObservation ?? "Sin nota registrada."}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold text-slate-950">Acciones del pedido</h3>
            <p className="mt-1 text-sm text-slate-600">
              El pedido avanza por estado. La revisión de pago vive dentro de Nuevo y no reemplaza
              el flujo principal.
            </p>

            {actionError ? (
              <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {actionError}
              </div>
            ) : null}
            {actionFeedback ? (
              <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {actionFeedback}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {requiresPaymentReview ? (
                  <button
                    type="button"
                    onClick={() => void runRequestPaymentProof()}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <OrdersUiIcon icon="clipboard" className="h-4 w-4" />
                    Solicitar comprobante
                  </button>
                ) : null}

                <OrderPaymentReviewPanel
                  order={currentOrder}
                  onUpdatePaymentStatus={onUpdatePaymentStatus}
                />
              </div>

              <div className={`rounded-[22px] border p-4 ${statusVisuals.softPanelClassName}`}>
                <p className="text-sm font-semibold">Acciones disponibles</p>
                <div className="mt-4 grid gap-3">
                  {order.status === "cancelado" ? (
                    canReactivate ? (
                      <button
                        type="button"
                        onClick={() => onOpenReactivateOrderModal(order.orderId)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
                      >
                        <OrdersUiIcon icon="save" className="h-4 w-4" />
                        Volver al estado anterior
                      </button>
                    ) : (
                      <div className="rounded-[18px] border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
                        Este pedido no puede reactivarse porque no guarda un estado anterior.
                      </div>
                    )
                  ) : (
                    <>
                      {canConfirm ? (
                        <button
                          type="button"
                          onClick={() => void runConfirmOrder()}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                        >
                          <OrdersUiIcon icon="clipboard-check" className="h-4 w-4" />
                          Confirmar pedido
                        </button>
                      ) : order.status === "nuevo" && requiresPaymentReview ? (
                        <div className="rounded-[18px] border border-sky-200 bg-white px-4 py-3 text-sm text-sky-800">
                          Revisa primero el pago antes de mover este pedido a Confirmado.
                        </div>
                      ) : null}
                      {canAdvance && nextWorkflowStatus ? (
                        <button
                          type="button"
                          onClick={() => void runAdvanceOrder()}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                        >
                          <OrdersUiIcon icon="clipboard-check" className="h-4 w-4" />
                          Mover a {ORDER_STATUS_LABELS[nextWorkflowStatus]}
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => onOpenCancelOrderModal(order.orderId)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          <OrdersUiIcon icon="x" className="h-4 w-4" />
                          Cancelar pedido
                        </button>
                      ) : null}
                      {!canConfirm && !canAdvance && !canCancel ? (
                        <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          No hay más acciones disponibles para este pedido.
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>

            {allowsFiado || order.isFiado ? (
              <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Fiado del negocio</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Uso interno del negocio. Nunca aparece como método público para el cliente.
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                    {order.isFiado ? `Fiado ${getFiadoStatusLabel(order.fiadoStatus)}` : "No marcado"}
                  </span>
                </div>

                {fiadoError ? (
                  <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {fiadoError}
                  </div>
                ) : null}
                {fiadoFeedback ? (
                  <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {fiadoFeedback}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Nota de fiado</span>
                    <textarea
                      rows={3}
                      value={fiadoObservationDraft}
                      onChange={(event) => {
                        setFiadoObservationDraft(event.target.value);
                        setFiadoError("");
                        setFiadoFeedback("");
                      }}
                      placeholder="No pagó hoy y quedó en cancelar mañana."
                      className="w-full rounded-[18px] border border-amber-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300"
                    />
                  </label>

                  <div className="grid gap-3 self-end">
                    {!order.isFiado ? (
                      <button
                        type="button"
                        onClick={() => void runMarkAsFiado()}
                        disabled={!allowsFiado}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
                          allowsFiado
                            ? "border border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-50"
                            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                      >
                        <OrdersUiIcon icon="clipboard" className="h-4 w-4" />
                        Guardar como fiado
                      </button>
                    ) : null}
                    {isPendingFiado ? (
                      <button
                        type="button"
                        onClick={() => void runMarkFiadoAsPaid()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                      >
                        <OrdersUiIcon icon="save" className="h-4 w-4" />
                        Marcar como pagado
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section
            data-testid="order-history-section"
            className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)]"
          >
            <h3 className="text-lg font-semibold text-slate-950">Historial del pedido</h3>
            <p className="mt-1 text-sm text-slate-600">
              Toda mutación relevante queda trazada con fecha y descripción legible.
            </p>
            <div className="mt-4 space-y-4">
              {sortedHistory.map((event) => (
                <article
                  key={event.id}
                  data-testid="order-history-event"
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{event.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                      {event.field ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            Campo: {event.field}
                          </span>
                          {event.previousValue ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              Antes: {event.previousValue}
                            </span>
                          ) : null}
                          {event.newValue ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              Ahora: {event.newValue}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <time className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
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
