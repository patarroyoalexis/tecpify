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
  "no verificado": "Por verificar",
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
  "no verificado": "clipboard-check",
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
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
    panelClassName: "border-sky-200/80 bg-sky-50/70 text-sky-900",
  },
};

export const ORDER_STATUS_VISUALS: Record<
  OrderStatus,
  {
    accentClassName: string;
    badgeClassName: string;
    boardHeaderClassName: string;
    boardSurfaceClassName: string;
    dotClassName: string;
    softPanelClassName: string;
  }
> = {
  nuevo: {
    accentClassName: "text-sky-700",
    badgeClassName:
      "border-sky-200 bg-sky-50 text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-sky-500/70 bg-[linear-gradient(135deg,#2563eb,#38bdf8)] text-white",
    boardSurfaceClassName: "border-sky-200/80 bg-sky-50/75",
    dotClassName: "bg-white",
    softPanelClassName: "border-sky-200/80 bg-sky-50/75",
  },
  confirmado: {
    accentClassName: "text-amber-700",
    badgeClassName:
      "border-amber-200 bg-amber-50 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-amber-400/80 bg-[linear-gradient(135deg,#f59e0b,#facc15)] text-amber-950",
    boardSurfaceClassName: "border-amber-200/80 bg-amber-50/80",
    dotClassName: "bg-amber-950",
    softPanelClassName: "border-amber-200/80 bg-amber-50/75",
  },
  "en preparación": {
    accentClassName: "text-orange-700",
    badgeClassName:
      "border-orange-200 bg-orange-50 text-orange-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-orange-400/80 bg-[linear-gradient(135deg,#f97316,#fb923c)] text-white",
    boardSurfaceClassName: "border-orange-200/80 bg-orange-50/80",
    dotClassName: "bg-white",
    softPanelClassName: "border-orange-200/80 bg-orange-50/75",
  },
  listo: {
    accentClassName: "text-emerald-700",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-emerald-400/80 bg-[linear-gradient(135deg,#16a34a,#34d399)] text-white",
    boardSurfaceClassName: "border-emerald-200/80 bg-emerald-50/80",
    dotClassName: "bg-white",
    softPanelClassName: "border-emerald-200/80 bg-emerald-50/75",
  },
  entregado: {
    accentClassName: "text-teal-700",
    badgeClassName:
      "border-teal-200 bg-teal-50 text-teal-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-teal-400/80 bg-[linear-gradient(135deg,#0f766e,#2dd4bf)] text-white",
    boardSurfaceClassName: "border-teal-200/80 bg-teal-50/80",
    dotClassName: "bg-white",
    softPanelClassName: "border-teal-200/80 bg-teal-50/75",
  },
  cancelado: {
    accentClassName: "text-rose-700",
    badgeClassName:
      "border-rose-200 bg-rose-50 text-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    boardHeaderClassName:
      "border-rose-400/80 bg-[linear-gradient(135deg,#dc2626,#fb7185)] text-white",
    boardSurfaceClassName: "border-rose-200/80 bg-rose-50/80",
    dotClassName: "bg-white",
    softPanelClassName: "border-rose-200/80 bg-rose-50/75",
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
