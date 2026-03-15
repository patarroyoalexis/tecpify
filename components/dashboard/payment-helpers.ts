import type {
  DeliveryType,
  Order,
  PaymentMethod,
} from "@/types/orders";

export const allPaymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Nequi",
  "Contra entrega",
];

export function isDigitalPayment(method: PaymentMethod): boolean {
  return (
    method === "Transferencia" ||
    method === "Tarjeta" ||
    method === "Nequi"
  );
}

export function isCashPayment(method: PaymentMethod): boolean {
  return method === "Efectivo" || method === "Contra entrega";
}

export function getAvailablePaymentMethods(
  deliveryType: DeliveryType | "",
): PaymentMethod[] {
  if (deliveryType === "recogida en tienda") {
    return allPaymentMethods.filter((method) => method !== "Contra entrega");
  }

  return allPaymentMethods;
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
