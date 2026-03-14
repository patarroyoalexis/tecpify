export const ORDER_STATUSES = [
  "pendiente de pago",
  "pago por verificar",
  "confirmado",
  "en preparación",
  "listo",
  "entregado",
  "cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

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

export interface Order {
  id: string;
  client: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  dateLabel: string;
  isReviewed: boolean;
  observations?: string;
}

export type MetricTone = "neutral" | "warning" | "info" | "success";

export interface MetricCard {
  title: string;
  value: string;
  description: string;
  tone: MetricTone;
}
