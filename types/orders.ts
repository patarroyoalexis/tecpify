import type { BusinessSlug, OrderCode, OrderId, ProductId } from "@/types/identifiers";

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
export const FIADO_STATUSES = ["pending", "paid"] as const;

export const DELIVERY_TYPES = ["domicilio", "recogida en tienda"] as const;
export const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Contra entrega",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type FiadoStatus = (typeof FIADO_STATUSES)[number];
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface OrderProduct {
  productId?: ProductId;
  name: string;
  quantity: number;
  unitPrice?: number;
}

export interface OrderHistoryEvent {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
}

export interface Order {
  orderId: OrderId;
  orderCode?: OrderCode;
  businessSlug: BusinessSlug;
  client: string;
  customerPhone?: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  isFiado: boolean;
  fiadoStatus: FiadoStatus | null;
  fiadoObservation: string | null;
  deliveryType: DeliveryType;
  address?: string;
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

export function isValidFiadoStatus(value: unknown): value is FiadoStatus {
  return typeof value === "string" && FIADO_STATUSES.includes(value as FiadoStatus);
}

export function isPendingFiadoOrder(
  order: Pick<Order, "isFiado" | "fiadoStatus">,
) {
  return order.isFiado && order.fiadoStatus === "pending";
}

export function getFiadoStatusLabel(status: FiadoStatus | null) {
  if (status === "pending") {
    return "Pendiente";
  }

  if (status === "paid") {
    return "Pagado";
  }

  return "No aplica";
}

export function getOrderDisplayCode(order: Pick<Order, "orderId" | "orderCode">) {
  const normalizedOrderCode = order.orderCode?.trim();

  if (normalizedOrderCode) {
    return normalizedOrderCode;
  }

  if (order.orderId.includes("-") && order.orderId.length >= 8) {
    return `LEG-${order.orderId.slice(0, 8).toUpperCase()}`;
  }

  return order.orderId;
}
