import type {
  DeliveryType,
  Order,
  PaymentMethod,
} from "@/types/orders";
import {
  isCashPaymentMethod,
  isDigitalPaymentMethod,
  isPaymentMethodAllowedForDeliveryType,
} from "@/lib/orders/state-rules";

export const allPaymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Nequi",
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
): PaymentMethod[] {
  if (!deliveryType) {
    return allPaymentMethods;
  }

  return allPaymentMethods.filter((method) =>
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
  return isDigitalPayment(order.paymentMethod);
}

export function getPaymentHelpMessage(order: Order): string {
  if (isDigitalPayment(order.paymentMethod)) {
    if (order.paymentStatus === "con novedad") {
      return "Revisa la novedad del pago antes de continuar con el pedido.";
    }

    return "Este pago requiere validacion previa antes de confirmar el pedido.";
  }

  return order.deliveryType === "domicilio"
    ? "Este pago se recibe al momento de la entrega. No requiere comprobante previo."
    : "Este pago se recibe al momento de la recogida. No requiere comprobante previo.";
}

export function getCashPaymentDisplayStatus(order: Order): string {
  return order.status === "entregado" ? "Pago recibido" : "Pago al recibir";
}
