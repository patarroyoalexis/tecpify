import type {
  DeliveryType,
  Order,
  PaymentMethod,
} from "@/types/orders";
import {
  isPaymentMethodAllowedForDeliveryType,
} from "@/lib/orders/state-rules";
import {
  getOrderPaymentGateMessage,
  isCashPaymentMethod,
  isDigitalPaymentMethod,
  requiresManualPaymentReview,
} from "@/lib/orders/payment-gate";

export const allPaymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Contra entrega",
];

export function isDigitalPayment(method: PaymentMethod): boolean {
  return isDigitalPaymentMethod(method);
}

export function isCashPayment(method: PaymentMethod): boolean {
  return isCashPaymentMethod(method);
}

export function getAvailablePaymentMethods(
  deliveryType: DeliveryType | "",
  allowedPaymentMethods: PaymentMethod[] = allPaymentMethods,
): PaymentMethod[] {
  if (!deliveryType) {
    return allowedPaymentMethods;
  }

  return allowedPaymentMethods.filter((method) =>
    isPaymentMethodAllowedForDeliveryType(method, deliveryType),
  );
}

export function getPaymentMethodLabel(
  method: PaymentMethod,
  deliveryType?: DeliveryType,
): string {
  if (method === "Contra entrega" && deliveryType === "domicilio") {
    return "Pago al recibir";
  }

  return method;
}

export function shouldShowPaymentVerificationActions(order: Order): boolean {
  return requiresManualPaymentReview(order);
}

export function getPaymentHelpMessage(order: Order): string {
  if (!shouldShowPaymentVerificationActions(order)) {
    if (order.isFiado) {
      return "Fiado se mantiene visible como condicion financiera separada y habilita la confirmacion sin comprobante previo.";
    }

    return order.deliveryType === "domicilio"
      ? "Esta condicion financiera no requiere comprobante previo para mover el pedido desde Nuevo."
      : "Esta condicion financiera no necesita validacion manual previa para seguir con la operacion.";
  }

  return getOrderPaymentGateMessage(order);
}

export function getCashPaymentDisplayStatus(order: Order): string {
  return order.status === "entregado" ? "Pago recibido" : "Pago al recibir";
}
