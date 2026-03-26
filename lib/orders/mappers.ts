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
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/types/orders";
import { deriveInitialOrderStateFromPaymentMethod } from "@/lib/orders/state-rules";

export type SupabaseOrderRow = Record<string, unknown>;

export type OrderCreationSource = "storefront" | "workspace";

export interface OrderCreateDraftPayload {
  customerName: string;
  customerWhatsApp: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  total: number;
  products: OrderProduct[];
}

export interface PublicOrderApiCreatePayload extends OrderCreateDraftPayload {
  businessSlug: string;
}

export type WorkspaceOrderApiCreatePayload = PublicOrderApiCreatePayload;

export interface OrderApiUpdatePayload {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  payment_status?: PaymentStatus;
  customerName?: string;
  customerWhatsApp?: string | null;
  deliveryType?: DeliveryType;
  deliveryAddress?: string | null;
  paymentMethod?: PaymentMethod;
  products?: OrderProduct[];
  notes?: string | null;
  total?: number;
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
    const productId =
      typeof candidate.productId === "string"
        ? candidate.productId
        : typeof candidate.product_id === "string"
          ? candidate.product_id
          : undefined;
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const quantity =
      typeof candidate.quantity === "number"
        ? candidate.quantity
        : typeof candidate.quantity === "string"
          ? Number(candidate.quantity)
          : 0;
    const unitPrice =
      typeof candidate.unitPrice === "number"
        ? candidate.unitPrice
        : typeof candidate.unit_price === "number"
          ? candidate.unit_price
          : typeof candidate.price === "number"
            ? candidate.price
            : undefined;

    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [
      {
        ...(productId ? { productId } : {}),
        name,
        quantity,
        ...(unitPrice !== undefined && Number.isFinite(unitPrice) && unitPrice >= 0
          ? { unitPrice }
          : {}),
      },
    ];
  });
}

export function normalizeOrderHistoryEvents(value: unknown): OrderHistoryEvent[] {
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
    const field = typeof candidate.field === "string" ? candidate.field : undefined;
    const previousValue =
      typeof candidate.previousValue === "string"
        ? candidate.previousValue
        : typeof candidate.previous_value === "string"
          ? candidate.previous_value
          : undefined;
    const newValue =
      typeof candidate.newValue === "string"
        ? candidate.newValue
        : typeof candidate.new_value === "string"
          ? candidate.new_value
          : undefined;

    if (!id || !title || !occurredAt) {
      return [];
    }

    return [{ id, title, description, occurredAt, field, previousValue, newValue }];
  });
}

export function calculateOrderProductsTotal(products: OrderProduct[]) {
  return products.reduce((sum, product) => {
    const unitPrice = product.unitPrice ?? 0;

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return sum;
    }

    return sum + unitPrice * product.quantity;
  }, 0);
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

export function createInitialOrderHistory(
  options: {
    orderId: string;
    businessSlug: string;
    createdAt: string;
    source: OrderCreationSource;
  },
): OrderHistoryEvent[] {
  const originEvent =
    options.source === "workspace"
      ? {
          id: `${options.businessSlug}-${options.createdAt}-workspace-created`,
          title: "Pedido creado manualmente",
          description:
            "El equipo del negocio registro el pedido manualmente desde el workspace privado.",
        }
      : {
          id: `${options.businessSlug}-${options.createdAt}-storefront-created`,
          title: "Pedido creado desde formulario publico",
          description:
            "El cliente confirmo el pedido desde el enlace compartido del negocio.",
        };

  return [
    {
      ...originEvent,
      occurredAt: options.createdAt,
    },
    {
      id: `${options.orderId}-created`,
      title: "Pedido registrado",
      description:
        options.source === "workspace"
          ? "El pedido manual quedo persistido en la base principal del MVP."
          : "El pedido quedo persistido en la base principal del MVP.",
      occurredAt: options.createdAt,
    },
  ];
}

export function buildInitialOrderServerState(options: {
  orderId: string;
  businessSlug: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  source: OrderCreationSource;
}) {
  const initialState = deriveInitialOrderStateFromPaymentMethod(options.paymentMethod);

  return {
    ...initialState,
    isReviewed: false,
    history: createInitialOrderHistory(options),
  };
}

export function mapSupabaseRowToOrder(
  row: SupabaseOrderRow,
  options?: { businessSlug?: string },
): Order {
  const createdAt = readString(row, "created_at", "createdAt");

  return {
    id: readString(row, "id"),
    orderCode: readString(row, "order_code", "orderCode") || undefined,
    businessSlug: options?.businessSlug ?? readString(row, "business_slug", "businessSlug"),
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
    history: normalizeOrderHistoryEvents(row.history),
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

export function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function normalizeOrderApiUpdatePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const candidate = payload as Record<string, unknown>;

  if ("payment_status" in candidate && !("paymentStatus" in candidate)) {
    return {
      ...candidate,
      paymentStatus: candidate.payment_status,
    };
  }

  return payload;
}

export function isValidOrderProducts(value: unknown): value is OrderProduct[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (product) =>
        product &&
        typeof product === "object" &&
        (product.productId === undefined ||
          (typeof product.productId === "string" && product.productId.trim().length > 0)) &&
        typeof product.name === "string" &&
        product.name.trim().length > 0 &&
        typeof product.quantity === "number" &&
        Number.isFinite(product.quantity) &&
        product.quantity > 0 &&
        (product.unitPrice === undefined ||
          (typeof product.unitPrice === "number" &&
            Number.isFinite(product.unitPrice) &&
            product.unitPrice >= 0)),
    )
  );
}
