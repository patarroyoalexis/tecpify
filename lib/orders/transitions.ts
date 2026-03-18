import type { Order, OrderStatus, PaymentStatus } from "@/types/orders";

export type StatusIconKey =
  | "alert-circle"
  | "circle-check"
  | "circle-x"
  | "clipboard-check"
  | "clock"
  | "dot"
  | "inbox"
  | "package-check"
  | "package-open"
  | "rotate-ccw"
  | "truck";

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

const FALLBACK_STATUS_ICON_KEY: StatusIconKey = "dot";

const ORDER_STATUS_ICON_KEYS: Partial<Record<OrderStatus, StatusIconKey>> = {
  "pendiente de pago": "inbox",
  "pago por verificar": "inbox",
  confirmado: "clipboard-check",
  "en preparación": "package-open",
  listo: "truck",
  entregado: "package-check",
  cancelado: "circle-x",
};

const PAYMENT_STATUS_ICON_KEYS: Partial<Record<PaymentStatus, StatusIconKey>> = {
  pendiente: "clock",
  verificado: "circle-check",
  "con novedad": "alert-circle",
  "no verificado": "circle-x",
};

export const FINAL_ORDER_STATUSES: OrderStatus[] = ["entregado", "cancelado"];

const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pendiente de pago",
  "pago por verificar",
  "confirmado",
  "en preparación",
  "listo",
  "entregado",
];

export function isFinalOrderStatus(status: OrderStatus) {
  return FINAL_ORDER_STATUSES.includes(status);
}

export function isPaymentConfirmed(paymentStatus: PaymentStatus) {
  return paymentStatus === "verificado";
}

export function getOrderStatusIconKey(status: string): StatusIconKey {
  return ORDER_STATUS_ICON_KEYS[status as OrderStatus] ?? FALLBACK_STATUS_ICON_KEY;
}

export function getPaymentStatusIconKey(status: string): StatusIconKey {
  return PAYMENT_STATUS_ICON_KEYS[status as PaymentStatus] ?? FALLBACK_STATUS_ICON_KEY;
}

export function isNewOrder(order: Pick<Order, "isReviewed">) {
  return !order.isReviewed;
}

export function canManageOrderStatus(order: Pick<Order, "paymentStatus">) {
  return isPaymentConfirmed(order.paymentStatus);
}

export function getAllowedOrderStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  if (isFinalOrderStatus(currentStatus)) {
    return [currentStatus];
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(currentStatus);
  const nextSequentialStatus =
    currentIndex >= 0 && currentIndex < ORDER_STATUS_SEQUENCE.length - 1
      ? ORDER_STATUS_SEQUENCE[currentIndex + 1]
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
  order: Order,
  nextStatus: OrderStatus,
): TransitionRuleResult {
  if (nextStatus === order.status) {
    return { allowed: true };
  }

  if (isFinalOrderStatus(order.status)) {
    return {
      allowed: false,
      reason: "Este pedido ya terminó su flujo y no puede seguir avanzando desde aquí.",
    };
  }

  if (!canAdvanceOrderStatus(order.status, nextStatus)) {
    return {
      allowed: false,
      reason: "Solo puedes mover el pedido al siguiente paso permitido del flujo.",
    };
  }

  if (nextStatus === "cancelado") {
    return {
      allowed: true,
      requiresConfirmation:
        "Vas a cancelar este pedido y cerrar su flujo operativo. Confirma para continuar.",
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
