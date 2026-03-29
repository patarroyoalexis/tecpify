"use client";

import { useState } from "react";

import { getPaymentMethodLabel } from "@/components/dashboard/payment-helpers";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { formatCurrency } from "@/data/orders";
import {
  getOrderFinancialCondition,
  getOrderFinancialConditionVisuals,
  getOrderPaymentGateMessage,
  ORDER_FINANCIAL_CONDITION_LABELS,
  requiresManualPaymentReview,
} from "@/lib/orders/payment-gate";
import { getFiadoStatusLabel, getOrderDisplayCode, type Order, type PaymentStatus } from "@/types/orders";

interface OrderPaymentReviewPanelProps {
  order: Order;
  onUpdatePaymentStatus: (
    orderId: Order["orderId"],
    paymentStatus: PaymentStatus,
  ) => Promise<Order>;
}

export function OrderPaymentReviewPanel({
  order,
  onUpdatePaymentStatus,
}: OrderPaymentReviewPanelProps) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const financialCondition = getOrderFinancialCondition(order);
  const visuals = getOrderFinancialConditionVisuals(financialCondition);
  const paymentMethodLabel = getPaymentMethodLabel(order.paymentMethod, order.deliveryType);
  const needsManualReview = requiresManualPaymentReview(order);

  async function runPaymentUpdate(nextPaymentStatus: PaymentStatus) {
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await onUpdatePaymentStatus(order.orderId, nextPaymentStatus);
      setFeedback(
        nextPaymentStatus === "verificado"
          ? "Pago marcado como verificado."
          : "Pago marcado con novedad.",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No fue posible actualizar la condicion financiera del pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      data-testid="order-payment-review-panel"
      className={`rounded-[22px] border p-4 ${visuals.panelClassName}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Revision de pago</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {getOrderPaymentGateMessage(order)}
          </p>
        </div>
        <span
          data-testid={`order-financial-condition-${order.orderId}`}
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${visuals.badgeClassName}`}
        >
          {ORDER_FINANCIAL_CONDITION_LABELS[financialCondition]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Pedido
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {getOrderDisplayCode(order)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{order.client}</p>
        </div>
        <div className="rounded-[18px] border border-white/70 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Cobro
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{paymentMethodLabel}</p>
          <p className="mt-1 text-sm text-slate-600">{formatCurrency(order.total)}</p>
        </div>
      </div>

      {order.isFiado ? (
        <div className="mt-4 rounded-[18px] border border-amber-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            Fiado visible: {getFiadoStatusLabel(order.fiadoStatus)}
          </p>
          <p className="mt-1">{order.fiadoObservation ?? "Sin observacion registrada."}</p>
        </div>
      ) : null}

      {financialCondition === "pendiente" && !order.isReviewed ? (
        <div className="mt-4 rounded-[18px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-800">
          Al revisar este pedido, la condicion pasa a visible como Por verificar hasta que lo resuelvas.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {needsManualReview ? (
          <>
            <button
              type="button"
              onClick={() => void runPaymentUpdate("verificado")}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <OrdersUiIcon icon="save" className="h-4 w-4" />
              Marcar verificado
            </button>
            <button
              type="button"
              onClick={() => void runPaymentUpdate("con novedad")}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <OrdersUiIcon icon="edit" className="h-4 w-4" />
              Marcar con novedad
            </button>
          </>
        ) : (
          <div className="sm:col-span-2 rounded-[18px] border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700">
            Esta condicion financiera no requiere validacion manual previa antes de confirmar el pedido.
          </div>
        )}
      </div>
    </div>
  );
}
