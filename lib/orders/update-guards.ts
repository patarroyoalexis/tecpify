import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/orders";
import { getOrderStateUpdateError } from "@/lib/orders/state-rules";

interface OrderTransitionSnapshot {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
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
  return getOrderStateUpdateError(
    {
      paymentMethod: order.paymentMethod ?? "Nequi",
      paymentStatus: order.paymentStatus,
      status: order.status,
    },
    {
      paymentMethod: order.paymentMethod,
      paymentStatus: readNextPaymentStatus(order, payload),
      status: payload.status,
    },
  );
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
