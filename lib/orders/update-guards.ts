import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import {
  getOrderStatusTransitionRule,
  isPaymentConfirmed,
} from "@/lib/orders/transitions";
import type { OrderStatus, PaymentStatus } from "@/types/orders";

interface OrderTransitionSnapshot {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

function readNextPaymentStatus(
  order: OrderTransitionSnapshot,
  payload: OrderApiUpdatePayload,
) {
  return payload.paymentStatus ?? payload.payment_status ?? order.paymentStatus;
}

export function getOrderUpdateTransitionError(
  order: OrderTransitionSnapshot,
  payload: OrderApiUpdatePayload,
) {
  if (payload.status === undefined || payload.status === order.status) {
    return null;
  }

  const nextPaymentStatus = readNextPaymentStatus(order, payload);
  const isCancellingOrder = payload.status === "cancelado";

  if (!isCancellingOrder && !isPaymentConfirmed(nextPaymentStatus)) {
    return "Invalid order update payload. No puedes avanzar el estado del pedido mientras el pago no este verificado.";
  }

  const statusRule = getOrderStatusTransitionRule({ status: order.status }, payload.status);

  if (!statusRule.allowed) {
    return `Invalid order update payload. ${statusRule.reason ?? "La transicion de estado no esta permitida."}`;
  }

  return null;
}

export function assertOrderUpdateTransitionAllowed(
  order: OrderTransitionSnapshot,
  payload: OrderApiUpdatePayload,
) {
  const transitionError = getOrderUpdateTransitionError(order, payload);

  if (transitionError) {
    throw new Error(transitionError);
  }
}
