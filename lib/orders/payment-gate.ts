import type {
  FiadoStatus,
  OrderFinancialCondition,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";

export interface OrderFinancialSnapshot {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  isFiado: boolean;
  fiadoStatus: FiadoStatus | null;
  isReviewed?: boolean;
}

export const DIGITAL_PAYMENT_METHODS = ["Transferencia", "Tarjeta"] as const;
export const CASH_PAYMENT_METHODS = ["Efectivo", "Contra entrega"] as const;

export const ORDER_FINANCIAL_CONDITION_LABELS: Record<OrderFinancialCondition, string> = {
  pendiente: "Pendiente",
  "por verificar": "Por verificar",
  verificado: "Verificado",
  "con novedad": "Con novedad",
  "contra entrega": "Contra entrega",
  fiado: "Fiado",
};

export const ORDER_FINANCIAL_CONDITION_VISUALS: Record<
  OrderFinancialCondition,
  {
    badgeClassName: string;
    panelClassName: string;
    accentClassName: string;
  }
> = {
  pendiente: {
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
    panelClassName: "border-slate-200/80 bg-slate-50/70 text-slate-900",
    accentClassName: "text-slate-700",
  },
  "por verificar": {
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
    panelClassName: "border-sky-200/80 bg-sky-50/70 text-sky-900",
    accentClassName: "text-sky-700",
  },
  verificado: {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    panelClassName: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
    accentClassName: "text-emerald-700",
  },
  "con novedad": {
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-800",
    panelClassName: "border-orange-200/80 bg-orange-50/70 text-orange-900",
    accentClassName: "text-orange-700",
  },
  "contra entrega": {
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-800",
    panelClassName: "border-cyan-200/80 bg-cyan-50/70 text-cyan-900",
    accentClassName: "text-cyan-700",
  },
  fiado: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    panelClassName: "border-amber-200/80 bg-amber-50/70 text-amber-900",
    accentClassName: "text-amber-700",
  },
};

export function isDigitalPaymentMethod(method: PaymentMethod): boolean {
  return DIGITAL_PAYMENT_METHODS.includes(method as (typeof DIGITAL_PAYMENT_METHODS)[number]);
}

export function isCashPaymentMethod(method: PaymentMethod): boolean {
  return CASH_PAYMENT_METHODS.includes(method as (typeof CASH_PAYMENT_METHODS)[number]);
}

export function getOrderFinancialCondition(
  order: Pick<
    OrderFinancialSnapshot,
    "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus" | "isReviewed"
  >,
): OrderFinancialCondition {
  if (order.isFiado) {
    return "fiado";
  }

  if (order.paymentMethod === "Contra entrega") {
    return "contra entrega";
  }

  if (order.paymentStatus === "verificado") {
    return "verificado";
  }

  if (order.paymentStatus === "con novedad") {
    return "con novedad";
  }

  if (order.paymentStatus === "no verificado") {
    return "por verificar";
  }

  return order.isReviewed ? "por verificar" : "pendiente";
}

export function getOrderFinancialConditionVisuals(condition: OrderFinancialCondition) {
  return ORDER_FINANCIAL_CONDITION_VISUALS[condition];
}

export function requiresManualPaymentReview(
  order: Pick<OrderFinancialSnapshot, "paymentMethod" | "isFiado">,
): boolean {
  return !order.isFiado && isDigitalPaymentMethod(order.paymentMethod);
}

export function canOrderMoveFromNewToConfirmed(
  order: Pick<OrderFinancialSnapshot, "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus">,
): boolean {
  if (order.isFiado) {
    return order.fiadoStatus === "pending" || order.fiadoStatus === "paid";
  }

  if (order.paymentMethod === "Contra entrega") {
    return true;
  }

  return order.paymentStatus === "verificado";
}

export function isOrderAwaitingPaymentReview(
  order: Pick<
    OrderFinancialSnapshot,
    "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus" | "isReviewed"
  >,
): boolean {
  return requiresManualPaymentReview(order) && !canOrderMoveFromNewToConfirmed(order);
}

export function getOrderPaymentGateMessage(
  order: Pick<
    OrderFinancialSnapshot,
    "paymentMethod" | "paymentStatus" | "isFiado" | "fiadoStatus" | "isReviewed"
  >,
): string {
  const condition = getOrderFinancialCondition(order);

  if (condition === "fiado") {
    return "Fiado habilita la confirmacion sin comprobante previo, pero sigue visible como condicion financiera separada.";
  }

  if (condition === "contra entrega") {
    return "Contra entrega habilita la confirmacion sin comprobante previo.";
  }

  if (condition === "verificado") {
    return "El pago ya quedo verificado y la compuerta de Nuevo esta abierta.";
  }

  if (condition === "con novedad") {
    return "El pago tiene una novedad y sigue bloqueando el avance de Nuevo a Confirmado.";
  }

  if (condition === "por verificar") {
    return "El pedido ya entro a revision manual, pero la compuerta sigue cerrada hasta verificar o registrar una novedad.";
  }

  return "El pedido sigue pendiente y necesita revision manual del pago antes de confirmar.";
}
