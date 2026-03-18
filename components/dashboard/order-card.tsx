"use client";

import { useEffect, useState } from "react";

import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { StatusBadgeIcon } from "@/components/dashboard/status-badge-icon";
import { getPaymentMethodLabel } from "@/components/dashboard/payment-helpers";
import {
  canManageOrderStatus,
  getAllowedOrderStatusTransitions,
  getOrderStatusIconKey,
  getOrderStatusTransitionRule,
  getPaymentStatusIconKey,
  isNewOrder,
  isFinalOrderStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/transitions";
import { formatCurrency, getOperationalPriority } from "@/data/orders";
import {
  getOrderDisplayCode,
  PAYMENT_STATUSES,
  type OperationalPriority,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from "@/types/orders";

const statusStyles: Record<OrderStatus, string> = {
  "pendiente de pago": "border-amber-200 bg-amber-50 text-amber-800",
  "pago por verificar": "border-sky-200 bg-sky-50 text-sky-800",
  confirmado: "border-indigo-200 bg-indigo-50 text-indigo-800",
  "en preparación": "border-orange-200 bg-orange-50 text-orange-800",
  listo: "border-emerald-200 bg-emerald-50 text-emerald-800",
  entregado: "border-green-200 bg-green-50 text-green-800",
  cancelado: "border-rose-200 bg-rose-50 text-rose-800",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  verificado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "con novedad": "border-orange-200 bg-orange-50 text-orange-800",
  "no verificado": "border-rose-200 bg-rose-50 text-rose-800",
};

const priorityStyles: Record<OperationalPriority, { accent: string }> = {
  alta: {
    accent: "border-l-4 border-l-rose-400",
  },
  media: {
    accent: "border-l-4 border-l-amber-400",
  },
  normal: {
    accent: "",
  },
};

interface OrderCardProps {
  order: Order;
  onOpenDetails: (orderId: string) => void;
  onQuickUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onQuickUpdatePaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
  ) => Promise<void>;
  compact?: boolean;
}

type FeedbackKind = "order" | "payment" | null;

function getProductSummary(order: Order) {
  const visibleProducts = order.products.slice(0, 2);
  const hiddenProductsCount = Math.max(order.products.length - visibleProducts.length, 0);
  const totalUnits = order.products.reduce((total, product) => total + product.quantity, 0);
  const visibleNames = visibleProducts.map((product) => product.name).join(", ");
  const moreLabel = hiddenProductsCount > 0 ? ` +${hiddenProductsCount} más` : "";

  return {
    totalUnits,
    visibleNames,
    moreLabel,
  };
}

function StopPropagationWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function OrderCard({
  order,
  onOpenDetails,
  onQuickUpdateOrderStatus,
  onQuickUpdatePaymentStatus,
  compact = false,
}: OrderCardProps) {
  const operationalPriority = getOperationalPriority(order);
  const baseCardPadding = compact ? "px-4 py-3.5" : "px-4 py-4 sm:px-5";
  const [selectedOrderStatus, setSelectedOrderStatus] = useState(order.status);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(order.paymentStatus);
  const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
  const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    setSelectedOrderStatus(order.status);
    setSelectedPaymentStatus(order.paymentStatus);
  }, [order.paymentStatus, order.status]);

  useEffect(() => {
    if (!feedbackKind) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackKind(null);
      setFeedbackMessage("");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackKind]);

  async function handleOrderStatusChange(nextStatus: OrderStatus) {
    if (nextStatus === order.status) {
      setSelectedOrderStatus(nextStatus);
      return;
    }

    const rule = getOrderStatusTransitionRule(order, nextStatus);

    if (!rule.allowed) {
      setSelectedOrderStatus(order.status);
      setFeedbackKind("order");
      setFeedbackMessage(rule.reason ?? "Cambio de estado no permitido.");
      return;
    }

    setSelectedOrderStatus(nextStatus);
    setIsUpdatingOrderStatus(true);

    try {
      await onQuickUpdateOrderStatus(order.id, nextStatus);
      setFeedbackKind("order");
      setFeedbackMessage("Pedido actualizado.");
    } catch (error) {
      setSelectedOrderStatus(order.status);
      setFeedbackKind("order");
      setFeedbackMessage(
        error instanceof Error ? error.message : "No fue posible actualizar el pedido.",
      );
    } finally {
      setIsUpdatingOrderStatus(false);
    }
  }

  async function handlePaymentStatusChange(nextStatus: PaymentStatus) {
    if (nextStatus === order.paymentStatus) {
      setSelectedPaymentStatus(nextStatus);
      return;
    }

    setSelectedPaymentStatus(nextStatus);
    setIsUpdatingPaymentStatus(true);

    try {
      await onQuickUpdatePaymentStatus(order.id, nextStatus);
      setFeedbackKind("payment");
      setFeedbackMessage("Pago actualizado.");
    } catch (error) {
      setSelectedPaymentStatus(order.paymentStatus);
      setFeedbackKind("payment");
      setFeedbackMessage(
        error instanceof Error ? error.message : "No fue posible actualizar el pago.",
      );
    } finally {
      setIsUpdatingPaymentStatus(false);
    }
  }

  const allowedOrderStatuses = getAllowedOrderStatusTransitions(order.status);
  const isOrderFlowClosed = isFinalOrderStatus(order.status);
  const showNewOrderBadge = isNewOrder(order);
  const canEditOrderStatus = canManageOrderStatus(order) && !isOrderFlowClosed;
  const { totalUnits, visibleNames, moreLabel } = getProductSummary(order);
  const paymentMethodLabel = getPaymentMethodLabel(order.paymentMethod, order.deliveryType);
  const hasAddress = Boolean(order.address?.trim());

  return (
    <article
      className={`rounded-[22px] border bg-white ${baseCardPadding} shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] active:translate-y-0 ${
        order.isReviewed ? "border-slate-200/80" : "border-rose-200 bg-rose-50/30"
      } ${priorityStyles[operationalPriority].accent}`}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-slate-950 sm:text-base">
                {order.client}
              </h3>
              {showNewOrderBadge ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Pedido nuevo
                </span>
              ) : !order.isReviewed ? (
                <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {getOrderDisplayCode(order)}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:flex-col sm:items-end">
            <p className="shrink-0 text-[15px] font-semibold text-slate-950 sm:text-base">
              {formatCurrency(order.total)}
            </p>
            <button
              type="button"
              onClick={() => onOpenDetails(order.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              aria-label={`Ver detalles del pedido ${getOrderDisplayCode(order)}`}
              title="Ver detalles"
            >
              <OrdersUiIcon icon="clipboard" className="h-3.5 w-3.5" />
              Detalles
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <OrdersUiIcon icon="package" className="mt-0.5 h-4 w-4 text-slate-400" />
            <span className="min-w-0">
              <span className="font-medium text-slate-900">
                {totalUnits} ud{totalUnits === 1 ? "" : "s"}
              </span>
              {visibleNames ? ` · ${visibleNames}${moreLabel}` : ""}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {hasAddress ? (
              <span className="inline-flex max-w-full items-center gap-1.5">
                <OrdersUiIcon icon="map-pin" className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{order.address}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <OrdersUiIcon icon="wallet" className="h-3.5 w-3.5 text-slate-400" />
              <span>Pago: {paymentMethodLabel}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {canEditOrderStatus ? (
            <StopPropagationWrapper>
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[selectedOrderStatus]}`}
              >
                <StatusBadgeIcon iconKey={getOrderStatusIconKey(selectedOrderStatus)} />
                <span className="whitespace-nowrap">Pedido</span>
                <select
                  value={selectedOrderStatus}
                  onChange={(event) =>
                    void handleOrderStatusChange(event.target.value as OrderStatus)
                  }
                  disabled={isUpdatingOrderStatus}
                  className="min-w-0 bg-transparent pr-4 text-xs font-semibold outline-none"
                >
                  {allowedOrderStatuses.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {ORDER_STATUS_LABELS[statusOption]}
                    </option>
                  ))}
                </select>
              </label>
            </StopPropagationWrapper>
          ) : (
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[selectedOrderStatus]}`}
            >
              <StatusBadgeIcon iconKey={getOrderStatusIconKey(selectedOrderStatus)} />
              <span className="whitespace-nowrap">Pedido</span>
              <span>{ORDER_STATUS_LABELS[selectedOrderStatus]}</span>
            </div>
          )}

          <StopPropagationWrapper>
            <label
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${paymentStatusStyles[selectedPaymentStatus]}`}
            >
              <StatusBadgeIcon iconKey={getPaymentStatusIconKey(selectedPaymentStatus)} />
              <span className="whitespace-nowrap">Pago</span>
              <select
                value={selectedPaymentStatus}
                onChange={(event) =>
                  void handlePaymentStatusChange(event.target.value as PaymentStatus)
                }
                disabled={isUpdatingPaymentStatus}
                className="min-w-0 bg-transparent pr-4 text-xs font-semibold outline-none"
              >
                {PAYMENT_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {PAYMENT_STATUS_LABELS[statusOption]}
                  </option>
                ))}
              </select>
            </label>
          </StopPropagationWrapper>

          {feedbackKind ? (
            <span className="text-xs font-medium text-slate-500">{feedbackMessage}</span>
          ) : isOrderFlowClosed ? (
            <span className="text-xs font-medium text-slate-500">
              Flujo del pedido finalizado.
            </span>
          ) : !canManageOrderStatus(order) ? (
            <span className="text-xs font-medium text-slate-500">
              Confirma el pago para habilitar el estado del pedido.
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

