import type { Order } from "@/types/orders";
import { ORDER_STATUS_LABELS, ORDER_WORKFLOW_STATUSES } from "@/lib/orders/status-system";
import {
  canOrderMoveFromNewToConfirmed,
  isOrderAwaitingPaymentReview,
} from "@/lib/orders/payment-gate";

export type OrderPrimaryActionKind =
  | "review_payment"
  | "confirm_order"
  | "advance_order"
  | "reactivate"
  | "details";

export interface OrderPrimaryActionDescriptor {
  kind: OrderPrimaryActionKind;
  label: string;
  nextStatus: Order["status"] | null;
}

export function getNextOperationalOrderStatus(status: Order["status"]) {
  const workflowStatuses = ORDER_WORKFLOW_STATUSES as readonly Order["status"][];
  const currentIndex = workflowStatuses.indexOf(status);

  if (currentIndex < 0 || currentIndex === workflowStatuses.length - 1) {
    return null;
  }

  return workflowStatuses[currentIndex + 1];
}

export function canCancelOrder(order: Pick<Order, "status">) {
  return ["nuevo", "confirmado", "en preparación", "listo"].includes(order.status);
}

export function getOrderPrimaryAction(
  order: Pick<
    Order,
    | "status"
    | "paymentMethod"
    | "paymentStatus"
    | "isFiado"
    | "fiadoStatus"
    | "isReviewed"
    | "previousStatusBeforeCancellation"
  >,
): OrderPrimaryActionDescriptor {
  if (order.status === "cancelado") {
    return order.previousStatusBeforeCancellation
      ? {
          kind: "reactivate",
          label: "Reactivar",
          nextStatus: order.previousStatusBeforeCancellation,
        }
      : {
          kind: "details",
          label: "Ver detalle",
          nextStatus: null,
        };
  }

  if (order.status === "nuevo") {
    if (canOrderMoveFromNewToConfirmed(order)) {
      return {
        kind: "confirm_order",
        label: "Confirmar pedido",
        nextStatus: "confirmado",
      };
    }

    if (isOrderAwaitingPaymentReview(order)) {
      return {
        kind: "review_payment",
        label: "Revisar pago",
        nextStatus: null,
      };
    }
  }

  const nextStatus = getNextOperationalOrderStatus(order.status);

  if (nextStatus) {
    return {
      kind: "advance_order",
      label: `Mover a ${ORDER_STATUS_LABELS[nextStatus]}`,
      nextStatus,
    };
  }

  return {
    kind: "details",
    label: "Ver detalle",
    nextStatus: null,
  };
}
