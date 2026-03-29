import type {
  CancellableOrderStatus,
  Order,
  OrderCancellationReason,
} from "@/types/orders";
import {
  ORDER_CANCELLABLE_STATUSES,
  ORDER_STATUSES,
} from "@/types/orders";
import { isValidOrderCancellationReason } from "@/lib/orders/status-system";

const CANCELLATION_OPERATION_FIELDS = new Set([
  "status",
  "cancellationReason",
  "cancellationDetail",
]);

const REACTIVATION_OPERATION_FIELDS = new Set(["reactivateCancelledOrder"]);

export function isCancellableOrderStatus(
  value: unknown,
): value is CancellableOrderStatus {
  return (
    typeof value === "string" &&
    ORDER_CANCELLABLE_STATUSES.includes(value as CancellableOrderStatus)
  );
}

export function isKnownOrderStatus(value: unknown) {
  return typeof value === "string" && ORDER_STATUSES.includes(value as Order["status"]);
}

export function normalizeCancellationDetail(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function getCancelOrderError(
  order: Pick<Order, "status">,
  payload: {
    status?: Order["status"];
    cancellationReason?: OrderCancellationReason;
    cancellationDetail?: string | null;
  },
  updatedFields?: string[],
) {
  if (payload.status !== "cancelado") {
    return "Debes usar status=\"cancelado\" para cancelar el pedido.";
  }

  if (order.status === "entregado") {
    return "No puedes cancelar un pedido que ya fue entregado.";
  }

  if (order.status === "cancelado") {
    return "Este pedido ya está cancelado.";
  }

  if (!isCancellableOrderStatus(order.status)) {
    return "Solo puedes cancelar pedidos en Nuevo, Confirmado, Preparación o Listo.";
  }

  if (!isValidOrderCancellationReason(payload.cancellationReason)) {
    return "Debes seleccionar un motivo de cancelación válido.";
  }

  const normalizedDetail = normalizeCancellationDetail(payload.cancellationDetail);

  if (payload.cancellationReason === "otro" && !normalizedDetail) {
    return 'Debes detallar la cancelación cuando el motivo es "Otro".';
  }

  if (payload.cancellationReason !== "otro" && normalizedDetail) {
    return 'El detalle libre solo se admite cuando el motivo es "Otro".';
  }

  if (
    updatedFields &&
    updatedFields.some((field) => !CANCELLATION_OPERATION_FIELDS.has(field))
  ) {
    return "La cancelación debe enviarse sola junto con su motivo obligatorio.";
  }

  return null;
}

export function getReactivateOrderError(
  order: Pick<Order, "status" | "previousStatusBeforeCancellation">,
  payload: {
    reactivateCancelledOrder?: boolean;
  },
  updatedFields?: string[],
) {
  if (!payload.reactivateCancelledOrder) {
    return "Debes indicar reactivateCancelledOrder=true para reactivar el pedido.";
  }

  if (order.status !== "cancelado") {
    return "Solo puedes reactivar pedidos que estén cancelados.";
  }

  if (!isCancellableOrderStatus(order.previousStatusBeforeCancellation)) {
    return "No fue posible reactivar este pedido porque no tiene un estado previo válido.";
  }

  if (
    updatedFields &&
    updatedFields.some((field) => !REACTIVATION_OPERATION_FIELDS.has(field))
  ) {
    return "La reactivación debe enviarse sola y volver exactamente al estado previo guardado.";
  }

  return null;
}
