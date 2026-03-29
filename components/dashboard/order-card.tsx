"use client";

import { useEffect, useMemo, useState } from "react";

import { getPaymentMethodLabel } from "@/components/dashboard/payment-helpers";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { StatusBadgeIcon } from "@/components/dashboard/status-badge-icon";
import { formatCurrency, formatElapsedTime, getOperationalPriority } from "@/data/orders";
import { canCancelOrder, getOrderPrimaryAction } from "@/lib/orders/action-semantics";
import {
  getOrderFinancialCondition,
  getOrderFinancialConditionVisuals,
  ORDER_FINANCIAL_CONDITION_LABELS,
} from "@/lib/orders/payment-gate";
import {
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
  getOrderStatusIconKey,
  getOrderStatusVisuals,
} from "@/lib/orders/status-system";
import {
  getFiadoStatusLabel,
  getOrderDisplayCode,
  type Order,
} from "@/types/orders";

interface OrderCardProps {
  order: Order;
  onOpenDetails: (orderId: Order["orderId"]) => void;
  onOpenPaymentReviewModal: (orderId: Order["orderId"]) => void;
  onConfirmOrder: (orderId: Order["orderId"]) => Promise<Order>;
  onAdvanceOrderStatus: (orderId: Order["orderId"]) => Promise<Order | undefined>;
  onOpenCancelOrderModal: (orderId: Order["orderId"]) => void;
  onOpenReactivateOrderModal: (orderId: Order["orderId"]) => void;
}

type FeedbackTone = "error" | "neutral" | "success";

function getProductSummary(order: Order) {
  const visibleProducts = order.products.slice(0, 2);
  const hiddenProductsCount = Math.max(order.products.length - visibleProducts.length, 0);
  const totalUnits = order.products.reduce((total, product) => total + product.quantity, 0);

  return {
    totalUnits,
    summary: visibleProducts.map((product) => `${product.quantity} x ${product.name}`).join(", "),
    hiddenProductsCount,
  };
}

function getPriorityAccent(order: Order) {
  const priority = getOperationalPriority(order);

  if (priority === "alta") {
    return "border-l-4 border-l-rose-400";
  }

  if (priority === "media") {
    return "border-l-4 border-l-amber-400";
  }

  return "";
}

export function OrderCard({
  order,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
}: OrderCardProps) {
  const [isRunningPrimaryAction, setIsRunningPrimaryAction] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const statusVisuals = getOrderStatusVisuals(order.status);
  const financialCondition = getOrderFinancialCondition(order);
  const financialVisuals = getOrderFinancialConditionVisuals(financialCondition);
  const paymentMethodLabel = getPaymentMethodLabel(order.paymentMethod, order.deliveryType);
  const primaryAction = getOrderPrimaryAction(order);
  const { totalUnits, summary, hiddenProductsCount } = getProductSummary(order);
  const canCancel = canCancelOrder(order);
  const feedbackClassName =
    feedbackTone === "error"
      ? "text-rose-700"
      : feedbackTone === "success"
        ? "text-emerald-700"
        : "text-slate-500";
  const financialSubtitle =
    order.isFiado && order.fiadoStatus
      ? `Fiado ${getFiadoStatusLabel(order.fiadoStatus).toLowerCase()}`
      : null;

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackMessage("");
      setFeedbackTone("neutral");
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackMessage]);

  const primaryActionIcon = useMemo(() => {
    if (primaryAction.kind === "review_payment") {
      return "edit" as const;
    }

    if (primaryAction.kind === "reactivate") {
      return "save" as const;
    }

    if (primaryAction.kind === "confirm_order" || primaryAction.kind === "advance_order") {
      return "clipboard-check" as const;
    }

    return "clipboard" as const;
  }, [primaryAction.kind]);

  async function runPrimaryAction() {
    setIsRunningPrimaryAction(true);
    setFeedbackMessage("");

    try {
      if (primaryAction.kind === "review_payment") {
        onOpenPaymentReviewModal(order.orderId);
        return;
      }

      if (primaryAction.kind === "confirm_order") {
        await onConfirmOrder(order.orderId);
        setFeedbackTone("success");
        setFeedbackMessage("Pedido confirmado.");
        return;
      }

      if (primaryAction.kind === "advance_order") {
        await onAdvanceOrderStatus(order.orderId);
        setFeedbackTone("success");
        setFeedbackMessage("Pedido movido al siguiente estado.");
        return;
      }

      if (primaryAction.kind === "reactivate") {
        onOpenReactivateOrderModal(order.orderId);
        return;
      }

      onOpenDetails(order.orderId);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(
        error instanceof Error ? error.message : "No fue posible completar la accion.",
      );
    } finally {
      setIsRunningPrimaryAction(false);
    }
  }

  return (
    <article
      data-testid={`order-card-${order.orderId}`}
      className={`flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] transition hover:border-slate-300 ${getPriorityAccent(order)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-950">{order.client}</h3>
            {!order.isReviewed ? (
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"
                aria-label="Pedido nuevo"
                title="Pedido nuevo"
              />
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
            <span>{getOrderDisplayCode(order)}</span>
            <span className="text-slate-300">•</span>
            <span>{order.dateLabel}</span>
            <span className="text-slate-300">•</span>
            <span>{formatElapsedTime(order)}</span>
          </div>
        </div>

        <p className="shrink-0 text-sm font-semibold text-slate-950">
          {formatCurrency(order.total)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div
          data-testid={`order-card-status-${order.orderId}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusVisuals.badgeClassName}`}
        >
          <StatusBadgeIcon iconKey={getOrderStatusIconKey(order.status)} />
          <span>{ORDER_STATUS_LABELS[order.status]}</span>
        </div>

        <div
          data-testid={`order-card-financial-condition-${order.orderId}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${financialVisuals.badgeClassName}`}
        >
          <span>{ORDER_FINANCIAL_CONDITION_LABELS[financialCondition]}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <p className="line-clamp-2">
          {summary}
          {hiddenProductsCount > 0 ? ` +${hiddenProductsCount} más` : ""}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{totalUnits} unidad{totalUnits === 1 ? "" : "es"}</span>
          <span>{order.deliveryType === "domicilio" ? "Domicilio" : "Recogida en tienda"}</span>
          <span>{paymentMethodLabel}</span>
        </div>
        {financialSubtitle ? (
          <p className={`text-xs font-medium ${financialVisuals.accentClassName}`}>
            {financialSubtitle}
          </p>
        ) : null}
        {order.address ? (
          <p className="line-clamp-2 text-xs text-slate-500">{order.address}</p>
        ) : null}
      </div>

      {order.status === "cancelado" ? (
        <div className={`mt-3 rounded-2xl border px-3.5 py-3 text-sm ${statusVisuals.softPanelClassName}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700/80">
            Cancelación
          </p>
          <p className="mt-2 font-medium text-slate-900">
            Motivo:{" "}
            {order.cancellationReason
              ? ORDER_CANCELLATION_REASON_LABELS[order.cancellationReason]
              : "Sin motivo registrado"}
          </p>
          <p className="mt-1 text-slate-700">
            Estado previo:{" "}
            {order.previousStatusBeforeCancellation
              ? ORDER_STATUS_LABELS[order.previousStatusBeforeCancellation]
              : "No disponible"}
          </p>
          {order.cancellationDetail ? (
            <p className="mt-1 text-slate-700">{order.cancellationDetail}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          {canCancel ? (
            <button
              type="button"
              onClick={() => onOpenCancelOrderModal(order.orderId)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
            >
              <OrdersUiIcon icon="x" className="h-3.5 w-3.5" />
              Cancelar
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenDetails(order.orderId)}
            aria-label={`Ver detalle del pedido ${getOrderDisplayCode(order)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <OrdersUiIcon icon="clipboard" className="h-3.5 w-3.5" />
            Ver detalle
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className={`min-h-[20px] text-xs font-medium ${feedbackClassName}`}>
            {feedbackMessage}
          </p>

          <button
            type="button"
            onClick={() => void runPrimaryAction()}
            disabled={isRunningPrimaryAction}
            data-testid={`order-card-primary-action-${order.orderId}`}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${statusVisuals.badgeClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <OrdersUiIcon icon={primaryActionIcon} className="h-3.5 w-3.5" />
            {primaryAction.label}
          </button>
        </div>
      </div>
    </article>
  );
}
