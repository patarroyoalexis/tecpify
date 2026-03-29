import type {
  ActiveOrderStatus,
  OrderCancellationReason,
  OrderStatus,
  PaymentStatus,
} from "@/types/orders";
import {
  ORDER_ACTIVE_STATUSES,
  ORDER_CANCELLABLE_STATUSES,
  ORDER_CANCELLATION_REASONS,
} from "@/types/orders";

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

export const ORDER_WORKFLOW_STATUSES: ActiveOrderStatus[] = [...ORDER_ACTIVE_STATUSES];
export const ORDER_REACTIVATABLE_STATUSES = [...ORDER_CANCELLABLE_STATUSES];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  "en preparación": "Preparación",
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

export const ORDER_CANCELLATION_REASON_LABELS: Record<OrderCancellationReason, string> = {
  "cliente_canceló": "Cliente canceló",
  error_de_captura: "Error de captura",
  pago_rechazado: "Pago rechazado",
  sin_respuesta_del_cliente: "Sin respuesta del cliente",
  producto_no_disponible: "Producto no disponible",
  pedido_duplicado: "Pedido duplicado",
  otro: "Otro",
};

export const ORDER_STATUS_ICON_KEYS: Record<OrderStatus, StatusIconKey> = {
  nuevo: "inbox",
  confirmado: "clipboard-check",
  "en preparación": "package-open",
  listo: "circle-check",
  entregado: "package-check",
  cancelado: "circle-x",
};

export const PAYMENT_STATUS_ICON_KEYS: Partial<Record<PaymentStatus, StatusIconKey>> = {
  pendiente: "clock",
  verificado: "circle-check",
  "con novedad": "alert-circle",
  "no verificado": "circle-x",
};

export const PAYMENT_STATUS_VISUALS: Record<
  PaymentStatus,
  {
    badgeClassName: string;
    panelClassName: string;
  }
> = {
  pendiente: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    panelClassName: "border-amber-200/80 bg-amber-50/70 text-amber-900",
  },
  verificado: {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    panelClassName: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
  },
  "con novedad": {
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-800",
    panelClassName: "border-orange-200/80 bg-orange-50/70 text-orange-900",
  },
  "no verificado": {
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-800",
    panelClassName: "border-rose-200/80 bg-rose-50/70 text-rose-900",
  },
};

export const ORDER_STATUS_VISUALS: Record<
  OrderStatus,
  {
    accentClassName: string;
    badgeClassName: string;
    boardHeaderClassName: string;
    dotClassName: string;
    softPanelClassName: string;
  }
> = {
  nuevo: {
    accentClassName: "text-sky-700",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
    boardHeaderClassName: "border-sky-200 bg-sky-50/90 text-sky-950",
    dotClassName: "bg-sky-500",
    softPanelClassName: "border-sky-200/80 bg-sky-50/60",
  },
  confirmado: {
    accentClassName: "text-amber-700",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    boardHeaderClassName: "border-amber-200 bg-amber-50/90 text-amber-950",
    dotClassName: "bg-amber-500",
    softPanelClassName: "border-amber-200/80 bg-amber-50/60",
  },
  "en preparación": {
    accentClassName: "text-violet-700",
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-800",
    boardHeaderClassName: "border-violet-200 bg-violet-50/90 text-violet-950",
    dotClassName: "bg-violet-500",
    softPanelClassName: "border-violet-200/80 bg-violet-50/60",
  },
  listo: {
    accentClassName: "text-emerald-700",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    boardHeaderClassName: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
    dotClassName: "bg-emerald-500",
    softPanelClassName: "border-emerald-200/80 bg-emerald-50/60",
  },
  entregado: {
    accentClassName: "text-teal-700",
    badgeClassName: "border-teal-200 bg-teal-50 text-teal-800",
    boardHeaderClassName: "border-teal-200 bg-teal-50/90 text-teal-950",
    dotClassName: "bg-teal-500",
    softPanelClassName: "border-teal-200/80 bg-teal-50/60",
  },
  cancelado: {
    accentClassName: "text-rose-700",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-800",
    boardHeaderClassName: "border-rose-200 bg-rose-50/90 text-rose-950",
    dotClassName: "bg-rose-500",
    softPanelClassName: "border-rose-200/80 bg-rose-50/60",
  },
};

export function isValidOrderCancellationReason(
  value: unknown,
): value is OrderCancellationReason {
  return (
    typeof value === "string" &&
    ORDER_CANCELLATION_REASONS.includes(value as OrderCancellationReason)
  );
}

export function getOrderStatusIconKey(status: string): StatusIconKey {
  return ORDER_STATUS_ICON_KEYS[status as OrderStatus] ?? "dot";
}

export function getPaymentStatusIconKey(status: string): StatusIconKey {
  return PAYMENT_STATUS_ICON_KEYS[status as PaymentStatus] ?? "dot";
}

export function getOrderStatusVisuals(status: OrderStatus) {
  return ORDER_STATUS_VISUALS[status];
}

export function getPaymentStatusVisuals(status: PaymentStatus) {
  return PAYMENT_STATUS_VISUALS[status];
}
