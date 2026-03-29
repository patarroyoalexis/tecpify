import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import type {
  DeliveryType,
  FiadoStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";
import { getOrderStateUpdateError } from "@/lib/orders/state-rules";

interface OrderTransitionSnapshot {
  deliveryType?: DeliveryType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  isFiado?: boolean;
  fiadoStatus?: FiadoStatus | null;
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
      deliveryType: order.deliveryType ?? "domicilio",
      paymentMethod: order.paymentMethod ?? "Transferencia",
      paymentStatus: order.paymentStatus,
      status: order.status,
    },
    {
      deliveryType: payload.deliveryType,
      paymentMethod: payload.paymentMethod,
      paymentStatus: readNextPaymentStatus(order, payload),
      status: payload.status,
    },
    {
      isFiado: order.isFiado ?? false,
      fiadoStatus: order.fiadoStatus ?? null,
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
