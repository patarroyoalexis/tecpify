"use client";

import { useEffect, useState } from "react";

import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import {
  getPaymentMethodLabel,
  shouldShowPaymentVerificationActions,
} from "@/components/dashboard/payment-helpers";
import { StatusBadgeIcon } from "@/components/dashboard/status-badge-icon";
import {
  canManageOrderStatus,
  getAllowedOrderStatusTransitions,
  getOrderStatusIconKey,
  getPaymentStatusIconKey,
  isFinalOrderStatus,
  isNewOrder,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/transitions";
import { formatCurrency, getOperationalPriority } from "@/data/orders";
import {
  getOrderDisplayCode,
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

interface NextStepAction {
  title: string;
  description: string;
  buttonLabel: string;
  tone: string;
  action:
    | { kind: "payment"; value: PaymentStatus }
    | { kind: "order"; value: OrderStatus }
    | { kind: "details" };
}

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

function getNextOrderStatus(order: Order) {
  return getAllowedOrderStatusTransitions(order.status).find(
    (statusOption) => statusOption !== order.status && statusOption !== "cancelado",
  );
}

function getNextStepAction(order: Order): NextStepAction {
  const nextOrderStatus = getNextOrderStatus(order);

  if (isFinalOrderStatus(order.status)) {
    return {
      title: "Flujo cerrado",
      description: "Este pedido ya termino. Abre el detalle si necesitas revisar el historial.",
      buttonLabel: "Ver detalle",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      action: { kind: "details" },
    };
  }

  if (shouldShowPaymentVerificationActions(order) && order.paymentStatus === "pendiente") {
    return {
      title: "Siguiente paso",
      description: "Validar el pago para destrabar la operacion del pedido.",
      buttonLabel: "Verificar pago",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      action: { kind: "payment", value: "verificado" },
    };
  }

  if (
    shouldShowPaymentVerificationActions(order) &&
    (order.paymentStatus === "con novedad" || order.paymentStatus === "no verificado")
  ) {
    return {
      title: "Pago con alerta",
      description: "Revisa el detalle del pago antes de mover el pedido.",
      buttonLabel: "Revisar detalle",
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      action: { kind: "details" },
    };
  }

  if (order.status === "pago por verificar") {
    return {
      title: "Siguiente paso",
      description: "El pago ya esta validado. Confirma el pedido para pasarlo a operacion.",
      buttonLabel: "Confirmar pedido",
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      action: { kind: "order", value: "confirmado" },
    };
  }

  if (canManageOrderStatus(order) && nextOrderStatus) {
    return {
      title: "Siguiente paso",
      description: `Mover el pedido a ${ORDER_STATUS_LABELS[nextOrderStatus].toLowerCase()}.`,
      buttonLabel: `Avanzar a ${ORDER_STATUS_LABELS[nextOrderStatus]}`,
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      action: { kind: "order", value: nextOrderStatus },
    };
  }

  return {
    title: "Siguiente paso",
    description: "Abre el detalle para continuar la gestion manual del pedido.",
    buttonLabel: "Ver detalle",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    action: { kind: "details" },
  };
}

export function OrderCard({
  order,
  onOpenDetails,
  onQuickUpdateOrderStatus,
  onQuickUpdatePaymentStatus,
  compact = false,
}: OrderCardProps) {
  const operationalPriority = getOperationalPriority(order);
  const baseCardPadding = compact ? "px-4 py-4 md:px-3.5 md:py-3" : "px-4 py-4 sm:px-5";
  const [isRunningPrimaryAction, setIsRunningPrimaryAction] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

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

  const isOrderFlowClosed = isFinalOrderStatus(order.status);
  const showNewOrderBadge = isNewOrder(order);
  const canEditOrderStatus = canManageOrderStatus(order) && !isOrderFlowClosed;
  const { totalUnits, visibleNames, moreLabel } = getProductSummary(order);
  const paymentMethodLabel = getPaymentMethodLabel(order.paymentMethod, order.deliveryType);
  const deliveryLabel =
    order.deliveryType === "domicilio" ? "Domicilio" : "Recogida en tienda";
  const hasAddress = Boolean(order.address?.trim());
  const nextStepAction = getNextStepAction(order);
  const detailsButton = (
    <button
      type="button"
      onClick={() => onOpenDetails(order.id)}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      aria-label={`Ver detalles del pedido ${getOrderDisplayCode(order)}`}
      title="Ver detalles"
    >
      <OrdersUiIcon icon="clipboard" className="h-3.5 w-3.5" />
      Detalles
    </button>
  );

  async function handlePrimaryAction() {
    setIsRunningPrimaryAction(true);

    try {
      if (nextStepAction.action.kind === "payment") {
        await onQuickUpdatePaymentStatus(order.id, nextStepAction.action.value);
        setFeedbackKind("payment");
        setFeedbackMessage("Pago actualizado.");
        return;
      }

      if (nextStepAction.action.kind === "order") {
        await onQuickUpdateOrderStatus(order.id, nextStepAction.action.value);
        setFeedbackKind("order");
        setFeedbackMessage("Pedido actualizado.");
        return;
      }

      onOpenDetails(order.id);
    } catch (error) {
      setFeedbackKind(nextStepAction.action.kind === "payment" ? "payment" : "order");
      setFeedbackMessage(
        error instanceof Error
          ? error.message
          : nextStepAction.action.kind === "payment"
            ? "No fue posible actualizar el pago."
            : "No fue posible actualizar el pedido.",
      );
    } finally {
      setIsRunningPrimaryAction(false);
    }
  }

  return (
    <article
      className={`relative h-full rounded-[22px] border bg-white ${compact ? baseCardPadding : "px-4 py-4 sm:px-4 sm:py-3.5"} shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition-colors ${
        order.isReviewed ? "border-slate-200/80" : "border-rose-200 bg-rose-50/30"
      } ${priorityStyles[operationalPriority].accent} hover:border-slate-300/90`}
    >
      {showNewOrderBadge ? (
        <span
          className="pointer-events-none absolute right-0 top-0 z-10 h-2.5 w-2.5 -translate-x-[10px] -translate-y-[5px] rounded-full border border-white/90 bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,0.72)]"
          aria-label="Pedido nuevo"
          title="Pedido nuevo"
        />
      ) : null}
      <div className="flex h-full flex-col space-y-3 sm:space-y-2.5">
        <div className="space-y-3 sm:grid sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] sm:items-start sm:gap-x-6 sm:gap-y-2">
          <div className="min-w-0 space-y-2 sm:space-y-1.5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate pr-4 text-[15px] font-semibold text-slate-950 sm:text-base">
                  {order.client}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                  <span>{getOrderDisplayCode(order)}</span>
                  <span className="hidden text-slate-300 sm:inline">•</span>
                  <span>{order.dateLabel}</span>
                </div>
                {order.customerPhone ? (
                  <p className="mt-1 text-xs text-slate-500">{order.customerPhone}</p>
                ) : null}
              </div>
              <div className="shrink-0 sm:hidden">{detailsButton}</div>
            </div>

            <p className="text-base font-semibold text-slate-950 sm:pt-0.5 sm:text-[15px]">
              {formatCurrency(order.total)}
            </p>
          </div>

          <div className="min-w-0 space-y-1.5">
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
              ) : (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <OrdersUiIcon icon="box" className="h-3.5 w-3.5 text-slate-400" />
                  <span>{deliveryLabel}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <OrdersUiIcon icon="wallet" className="h-3.5 w-3.5 text-slate-400" />
                <span>Pago: {paymentMethodLabel}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
          <div className={`rounded-2xl border px-3.5 py-3 ${statusStyles[order.status]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
              Estado del pedido
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadgeIcon iconKey={getOrderStatusIconKey(order.status)} />
              <span className="text-sm font-semibold">{ORDER_STATUS_LABELS[order.status]}</span>
            </div>
          </div>
          <div className={`rounded-2xl border px-3.5 py-3 ${paymentStatusStyles[order.paymentStatus]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
              Estado del pago
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadgeIcon iconKey={getPaymentStatusIconKey(order.paymentStatus)} />
              <span className="text-sm font-semibold">
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </span>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${nextStepAction.tone}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                {nextStepAction.title}
              </p>
              <p className="mt-1 text-sm font-medium">{nextStepAction.description}</p>
            </div>
            <StopPropagationWrapper>
              <button
                type="button"
                onClick={() => void handlePrimaryAction()}
                disabled={isRunningPrimaryAction}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-current/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-inherit transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <OrdersUiIcon
                  icon={
                    nextStepAction.action.kind === "payment"
                      ? "save"
                      : nextStepAction.action.kind === "order"
                        ? "clipboard-check"
                        : "clipboard"
                  }
                  className="h-3.5 w-3.5"
                />
                {nextStepAction.buttonLabel}
              </button>
            </StopPropagationWrapper>
          </div>
        </div>

        <div className="pt-1 sm:mt-auto">
          <div className="space-y-2 sm:hidden">
            {feedbackKind ? (
              <span className="text-xs font-medium text-slate-500">{feedbackMessage}</span>
            ) : isOrderFlowClosed ? (
              <span className="text-xs font-medium text-slate-500">
                Flujo del pedido finalizado.
              </span>
            ) : !canEditOrderStatus ? (
              <span className="text-xs font-medium text-slate-500">
                Confirma el pago para habilitar el estado del pedido.
              </span>
            ) : null}
          </div>

          <div className="hidden w-full items-center justify-between gap-3 sm:flex">
            {feedbackKind ? (
              <span className="flex-1 text-xs font-medium text-slate-500">{feedbackMessage}</span>
            ) : isOrderFlowClosed ? (
              <span className="flex-1 text-xs font-medium text-slate-500">
                Flujo del pedido finalizado.
              </span>
            ) : !canEditOrderStatus ? (
              <span className="flex-1 text-xs font-medium text-slate-500">
                Confirma el pago para habilitar el estado del pedido.
              </span>
            ) : (
              <span className="flex-1" />
            )}
            <div className="shrink-0">{detailsButton}</div>
          </div>
        </div>
      </div>
    </article>
  );
}
