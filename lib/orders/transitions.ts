import type { Order, OrderStatus, PaymentStatus } from "@/types/orders";
import { canOrderMoveFromNewToConfirmed } from "@/lib/orders/payment-gate";
import {
  ORDER_STATUS_LABELS,
  ORDER_WORKFLOW_STATUSES,
  PAYMENT_STATUS_LABELS,
  type StatusIconKey,
  getOrderStatusIconKey,
  getPaymentStatusIconKey,
} from "@/lib/orders/status-system";

export { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS };
export { getOrderStatusIconKey, getPaymentStatusIconKey };
export type { StatusIconKey };

export interface TransitionRuleResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: string;
}

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["entregado"];
export const EXCEPTIONAL_ORDER_STATUSES: OrderStatus[] = ["cancelado"];

export function isTerminalOrderStatus(status: OrderStatus) {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

export function isExceptionalOrderStatus(status: OrderStatus) {
  return EXCEPTIONAL_ORDER_STATUSES.includes(status);
}

export function isFinalOrderStatus(status: OrderStatus) {
  return isTerminalOrderStatus(status) || isExceptionalOrderStatus(status);
}

export function isPaymentConfirmed(paymentStatus: PaymentStatus) {
  return paymentStatus === "verificado";
}

export function isNewOrder(order: Pick<Order, "isReviewed">) {
  return !order.isReviewed;
}

export function canManageOrderStatus(
  order: Pick<Order, "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus">,
) {
  return canOrderMoveFromNewToConfirmed(order);
}

export function getAllowedOrderStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  if (currentStatus === "cancelado") {
    return ["cancelado"];
  }

  if (currentStatus === "entregado") {
    return ["entregado"];
  }

  const currentIndex = ORDER_WORKFLOW_STATUSES.indexOf(currentStatus);
  const nextSequentialStatus =
    currentIndex >= 0 && currentIndex < ORDER_WORKFLOW_STATUSES.length - 1
      ? ORDER_WORKFLOW_STATUSES[currentIndex + 1]
      : null;

  return [
    currentStatus,
    ...(nextSequentialStatus ? [nextSequentialStatus] : []),
    "cancelado",
  ];
}

export function canAdvanceOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  return getAllowedOrderStatusTransitions(currentStatus).includes(nextStatus);
}

export function getOrderStatusTransitionRule(
  order: Pick<
    Order,
    "status" | "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus"
  >,
  nextStatus: OrderStatus,
): TransitionRuleResult {
  if (nextStatus === order.status) {
    return { allowed: true };
  }

  if (order.status === "entregado") {
    return {
      allowed: false,
      reason: "Este pedido ya terminó su flujo y no puede seguir avanzando desde aquí.",
    };
  }

  if (order.status === "cancelado") {
    return {
      allowed: false,
      reason: "Este pedido está cancelado y debe reactivarse antes de volver al flujo operativo.",
    };
  }

  if (nextStatus === "cancelado") {
    return {
      allowed: true,
      requiresConfirmation:
        "Vas a sacar este pedido del flujo principal. La cancelación exige motivo obligatorio.",
    };
  }

  if (!canAdvanceOrderStatus(order.status, nextStatus)) {
    return {
      allowed: false,
      reason: "Solo puedes mover el pedido al siguiente paso permitido del flujo.",
    };
  }

  if (nextStatus === "confirmado" && !canOrderMoveFromNewToConfirmed(order)) {
    return {
      allowed: false,
      reason:
        "No puedes confirmar el pedido mientras la condición financiera siga bloqueando la compuerta de Nuevo.",
    };
  }

  return { allowed: true };
}

export function getPaymentStatusTransitionRule(
  order: Pick<Order, "paymentStatus">,
  nextStatus: PaymentStatus,
): TransitionRuleResult {
  if (nextStatus === order.paymentStatus) {
    return { allowed: true };
  }

  if (order.paymentStatus === "verificado") {
    return {
      allowed: true,
      requiresConfirmation:
        nextStatus === "no verificado"
          ? "Vas a cambiar un pago verificado a No verificado. Confirma solo si necesitas revertir la validación."
          : "Vas a cambiar un pago ya verificado. Confirma para continuar.",
    };
  }

  return { allowed: true };
}
