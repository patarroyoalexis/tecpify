import type {
  DeliveryType,
  Order,
  OrderHistoryEvent,
  OrderProduct,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";
import {
  DELIVERY_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
} from "@/types/orders";

export type SupabaseOrderRow = Record<string, unknown>;

export interface OrderApiCreatePayload {
  businessSlug: string;
  customerName: string;
  customerWhatsApp: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  total: number;
  status?: OrderStatus;
  products: OrderProduct[];
  paymentStatus?: PaymentStatus;
  dateLabel?: string;
  isReviewed?: boolean;
  history?: OrderHistoryEvent[];
}

function readString(row: SupabaseOrderRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return "";
}

function readNumber(row: SupabaseOrderRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return 0;
}

function readBoolean(row: SupabaseOrderRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
}

function mapProducts(value: unknown): OrderProduct[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const quantity =
      typeof candidate.quantity === "number"
        ? candidate.quantity
        : typeof candidate.quantity === "string"
          ? Number(candidate.quantity)
          : 0;

    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{ name, quantity }];
  });
}

function mapHistory(value: unknown): OrderHistoryEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const title = typeof candidate.title === "string" ? candidate.title : "";
    const description =
      typeof candidate.description === "string" ? candidate.description : "";
    const occurredAt =
      typeof candidate.occurredAt === "string"
        ? candidate.occurredAt
        : typeof candidate.occurred_at === "string"
          ? candidate.occurred_at
          : "";

    if (!id || !title || !occurredAt) {
      return [];
    }

    return [{ id, title, description, occurredAt }];
  });
}

function buildDateLabel(createdAt: string, fallback: string) {
  if (fallback) {
    return fallback;
  }

  if (!createdAt) {
    return "";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

export function getInitialOrderState(paymentMethod: PaymentMethod) {
  const isDigitalPayment =
    paymentMethod === "Transferencia" ||
    paymentMethod === "Tarjeta" ||
    paymentMethod === "Nequi";

  if (isDigitalPayment) {
    return {
      paymentStatus: "pendiente" as PaymentStatus,
      status: "pendiente de pago" as OrderStatus,
    };
  }

  return {
    paymentStatus: "verificado" as PaymentStatus,
    status: "confirmado" as OrderStatus,
  };
}

export function createInitialOrderHistory(
  orderId: string,
  businessSlug: string,
  createdAt: string,
): OrderHistoryEvent[] {
  return [
    {
      id: `${businessSlug}-${createdAt}-created`,
      title: "Pedido creado desde formulario publico",
      description: "El cliente confirmo el pedido desde el enlace compartido del negocio.",
      occurredAt: createdAt,
    },
    {
      id: `${orderId}-created`,
      title: "Pedido registrado",
      description: "El pedido quedo persistido en la base principal del MVP.",
      occurredAt: createdAt,
    },
  ];
}

export function mapSupabaseRowToOrder(
  row: SupabaseOrderRow,
  options?: { businessSlug?: string },
): Order {
  const createdAt = readString(row, "created_at", "createdAt");

  return {
    id: readString(row, "id"),
    orderCode: readString(row, "order_code", "orderCode") || undefined,
    businessId: options?.businessSlug ?? readString(row, "business_id", "businessId"),
    client: readString(row, "customer_name", "client"),
    customerPhone:
      readString(row, "customer_whatsapp", "customer_phone", "customerPhone") || undefined,
    products: mapProducts(row.products),
    total: readNumber(row, "total"),
    paymentMethod: readString(
      row,
      "payment_method",
      "paymentMethod",
    ) as PaymentMethod,
    paymentStatus: readString(
      row,
      "payment_status",
      "paymentStatus",
    ) as PaymentStatus,
    deliveryType: readString(row, "delivery_type", "deliveryType") as DeliveryType,
    address: readString(row, "delivery_address", "address") || undefined,
    status: readString(row, "status") as OrderStatus,
    dateLabel: buildDateLabel(createdAt, readString(row, "date_label", "dateLabel")),
    createdAt,
    isReviewed: readBoolean(row, "is_reviewed", "isReviewed"),
    history: mapHistory(row.history),
    observations: readString(row, "notes", "observations") || undefined,
  };
}

export function isValidDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPES.includes(value as DeliveryType);
}

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

export function isValidPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function isValidOrderProducts(value: unknown): value is OrderProduct[] {
  return (
    Array.isArray(value) &&
    value.every(
      (product) =>
        product &&
        typeof product === "object" &&
        typeof product.name === "string" &&
        product.name.trim().length > 0 &&
        typeof product.quantity === "number" &&
        Number.isFinite(product.quantity) &&
        product.quantity > 0,
    )
  );
}
