import { isDigitalPayment } from "@/components/dashboard/payment-helpers";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
} from "@/types/orders";

export interface TransitionRuleResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  "pendiente de pago": "Pendiente de pago",
  "pago por verificar": "Pago por verificar",
  confirmado: "Confirmado",
  "en preparación": "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendiente: "Pendiente",
  verificado: "Verificado",
  "con novedad": "Con novedad",
  "no verificado": "No verificado",
};

function getAllowedOrderStatusTargets(order: Order): OrderStatus[] {
  switch (order.status) {
    case "pendiente de pago":
      return ["pendiente de pago", "pago por verificar", "confirmado", "cancelado"];
    case "pago por verificar":
      return ["pendiente de pago", "pago por verificar", "confirmado", "cancelado"];
    case "confirmado":
      return isDigitalPayment(order.paymentMethod)
        ? [
            "pendiente de pago",
            "pago por verificar",
            "confirmado",
            "en preparación",
            "cancelado",
          ]
        : ["confirmado", "en preparación", "cancelado"];
    case "en preparación":
      return ["confirmado", "en preparación", "listo", "cancelado"];
    case "listo":
      return ["en preparación", "listo", "entregado", "cancelado"];
    case "entregado":
      return ["listo", "entregado"];
    case "cancelado":
      return ["cancelado"];
    default:
      return [order.status];
  }
}

export function getOrderStatusTransitionRule(
  order: Order,
  nextStatus: OrderStatus,
): TransitionRuleResult {
  if (nextStatus === order.status) {
    return { allowed: true };
  }

  if (
    isDigitalPayment(order.paymentMethod) &&
    order.paymentStatus !== "verificado" &&
    (order.status === "pendiente de pago" || order.status === "pago por verificar") &&
    ["confirmado", "en preparación", "listo", "entregado"].includes(nextStatus)
  ) {
    return {
      allowed: false,
      reason: "Primero debes verificar el pago antes de avanzar el pedido en una pasarela digital.",
    };
  }

  if (!getAllowedOrderStatusTargets(order).includes(nextStatus)) {
    if (order.status === "cancelado") {
      return {
        allowed: false,
        reason: "Los pedidos cancelados no se pueden reabrir desde esta vista.",
      };
    }

    if (order.status === "entregado") {
      return {
        allowed: false,
        reason: "Un pedido entregado solo puede volver a Listo si necesitas corregir la entrega.",
      };
    }

    return {
      allowed: false,
      reason: "Ese cambio no es coherente con el flujo operativo actual del pedido.",
    };
  }

  if (order.status === "entregado" && nextStatus === "listo") {
    return {
      allowed: true,
      requiresConfirmation:
        "Vas a devolver un pedido entregado a Listo. Confirma solo si necesitas corregir la entrega.",
    };
  }

  if (
    order.status === "confirmado" &&
    (nextStatus === "pendiente de pago" || nextStatus === "pago por verificar")
  ) {
    return {
      allowed: true,
      requiresConfirmation:
        "Vas a regresar el pedido a una etapa previa de validación. Úsalo solo si el negocio necesita rehacer la confirmación.",
    };
  }

  if (
    nextStatus === "cancelado" &&
    ["confirmado", "en preparación", "listo"].includes(order.status)
  ) {
    return {
      allowed: true,
      requiresConfirmation:
        "Vas a cancelar un pedido que ya avanzó en operación. Confirma para continuar.",
    };
  }

  return { allowed: true };
}

export function getPaymentStatusTransitionRule(
  order: Order,
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
