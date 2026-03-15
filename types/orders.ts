export const ORDER_STATUSES = [
  "pendiente de pago",
  "pago por verificar",
  "confirmado",
  "en preparación",
  "listo",
  "entregado",
  "cancelado",
] as const;

export const PAYMENT_STATUSES = [
  "pendiente",
  "verificado",
  "con novedad",
  "no verificado",
] as const;

export const DELIVERY_TYPES = ["domicilio", "recogida en tienda"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export type PaymentMethod =
  | "Efectivo"
  | "Transferencia"
  | "Tarjeta"
  | "Nequi"
  | "Contra entrega";

export interface OrderProduct {
  name: string;
  quantity: number;
}

export interface OrderHistoryEvent {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
}

export interface Order {
  id: string;
  client: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryType: DeliveryType;
  status: OrderStatus;
  dateLabel: string;
  createdAt: string;
  isReviewed: boolean;
  history: OrderHistoryEvent[];
  observations?: string;
}

export type OperationalPriority = "alta" | "media" | "normal";

export type MetricTone = "neutral" | "warning" | "info" | "success";

export interface MetricCard {
  title: string;
  value: string;
  description: string;
  tone: MetricTone;
}
