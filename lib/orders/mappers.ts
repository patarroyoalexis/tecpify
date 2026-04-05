import type {
  CancellableOrderStatus,
  DeliveryType,
  FiadoStatus,
  Order,
  OrderCancellationReason,
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
  isValidFiadoStatus,
} from "@/types/orders";
import {
  createInitialOrderHistory,
  type OrderOrigin,
  type OrderUpdateEventIntent,
} from "@/lib/orders/history-rules";
import {
  deriveInitialOrderStateFromPaymentMethod,
  getOrderPaymentMethodDeliveryTypeError,
} from "@/lib/orders/state-rules";
import { requireBusinessSlug } from "@/lib/businesses/slug";
import {
  requireOrderCode,
  requireOrderId,
  requireProductId,
  type BusinessSlug,
  type OrderId,
} from "@/types/identifiers";
import type { LocalDeliveryQuoteContext } from "@/types/local-delivery";

export type SupabaseOrderRow = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export interface OrderCreateDraftPayload {
  customerName: string;
  customerWhatsApp: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryNeighborhoodId?: string;
  deliveryReference?: string;
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
  isFiado?: boolean;
  fiadoStatus?: FiadoStatus | null;
  fiadoObservation?: string | null;
  eventIntent?: OrderUpdateEventIntent;
  cancellationReason?: OrderCancellationReason;
  cancellationDetail?: string | null;
  reactivateCancelledOrder?: boolean;
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

function readOptionalNumber(row: SupabaseOrderRow, ...keys: string[]) {
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }

    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }

    return null;
  }

  return null;
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

function mapLocalDeliveryQuoteContext(value: unknown): LocalDeliveryQuoteContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const distanceKm = readNumber(candidate, "distanceKm", "distance_km");
  const pricingBandFee = readNumber(
    isPlainObject(candidate.pricingBand) ? candidate.pricingBand : {},
    "fee",
  );
  const pricingBandUpToKm = readNumber(
    isPlainObject(candidate.pricingBand) ? candidate.pricingBand : {},
    "upToKm",
    "up_to_km",
  );
  const originNeighborhoodId = readString(
    candidate,
    "originNeighborhoodId",
    "origin_neighborhood_id",
  );
  const originNeighborhoodName = readString(
    candidate,
    "originNeighborhoodName",
    "origin_neighborhood_name",
  );
  const destinationNeighborhoodId = readString(
    candidate,
    "destinationNeighborhoodId",
    "destination_neighborhood_id",
  );
  const destinationNeighborhoodName = readString(
    candidate,
    "destinationNeighborhoodName",
    "destination_neighborhood_name",
  );
  const cityKey = readString(candidate, "cityKey", "city_key");
  const cityName = readString(candidate, "cityName", "city_name");

  if (
    !originNeighborhoodId ||
    !originNeighborhoodName ||
    !destinationNeighborhoodId ||
    !destinationNeighborhoodName ||
    !cityKey ||
    !cityName ||
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(pricingBandFee) ||
    !Number.isFinite(pricingBandUpToKm)
  ) {
    return null;
  }

  return {
    originNeighborhoodId,
    originNeighborhoodName,
    destinationNeighborhoodId,
    destinationNeighborhoodName,
    cityKey,
    cityName,
    distanceKm,
    pricingBand: {
      fee: pricingBandFee,
      upToKm: pricingBandUpToKm,
    },
  };
}

function mapRawPersistedOrderProducts(value: unknown): OrderProduct[] {
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
        ? requireProductId(candidate.productId)
        : typeof candidate.product_id === "string"
          ? requireProductId(candidate.product_id)
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

export function buildInitialOrderServerState(options: {
  orderId: OrderId;
  businessSlug: BusinessSlug;
  createdAt: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  origin: OrderOrigin;
}) {
  const paymentMethodDeliveryTypeError = getOrderPaymentMethodDeliveryTypeError(
    options.deliveryType,
    options.paymentMethod,
  );

  if (paymentMethodDeliveryTypeError) {
    throw new Error(paymentMethodDeliveryTypeError);
  }

  const initialState = deriveInitialOrderStateFromPaymentMethod(options.paymentMethod);

  return {
    ...initialState,
    isReviewed: false,
    isFiado: false,
    fiadoStatus: null,
    fiadoObservation: null,
    history: createInitialOrderHistory(options),
  };
}

export function mapSupabaseRowToOrder(
  row: SupabaseOrderRow,
  options?: { businessSlug?: BusinessSlug },
): Order {
  const createdAt = readString(row, "created_at", "createdAt");
  const resolvedBusinessSlug = options?.businessSlug ?? readString(row, "business_slug", "businessSlug");
  const products = mapRawPersistedOrderProducts(row.products);
  const total = readNumber(row, "total");
  const deliveryType = readString(row, "delivery_type", "deliveryType") as DeliveryType;
  const explicitDeliveryFee = readOptionalNumber(row, "delivery_fee", "deliveryFee");
  const derivedDeliveryFee =
    deliveryType === "domicilio"
      ? Math.max(0, Number((total - calculateOrderProductsTotal(products)).toFixed(2)))
      : 0;
  const deliveryFee = explicitDeliveryFee ?? derivedDeliveryFee;

  return {
    orderId: requireOrderId(readString(row, "id")),
    orderCode: (() => {
      const rawOrderCode = readString(row, "order_code", "orderCode");
      return rawOrderCode ? requireOrderCode(rawOrderCode) : undefined;
    })(),
    businessSlug: requireBusinessSlug(resolvedBusinessSlug),
    client: readString(row, "customer_name", "client"),
    customerPhone:
      readString(row, "customer_whatsapp", "customer_phone", "customerPhone") || undefined,
    products,
    total,
    deliveryFee,
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
    isFiado: readBoolean(row, "is_fiado", "isFiado"),
    fiadoStatus: (() => {
      const fiadoStatus = readString(row, "fiado_status", "fiadoStatus");

      return fiadoStatus && isValidFiadoStatus(fiadoStatus) ? fiadoStatus : null;
    })(),
    fiadoObservation:
      readString(row, "fiado_observation", "fiadoObservation") || null,
    previousStatusBeforeCancellation: (() => {
      const previousStatus = readString(
        row,
        "previous_status_before_cancellation",
        "previousStatusBeforeCancellation",
      );

      return previousStatus ? (previousStatus as CancellableOrderStatus) : null;
    })(),
    cancellationReason: (() => {
      const cancellationReason = readString(
        row,
        "cancellation_reason",
        "cancellationReason",
      );

      return cancellationReason
        ? (cancellationReason as OrderCancellationReason)
        : null;
    })(),
    cancellationDetail:
      readString(row, "cancellation_detail", "cancellationDetail") || null,
    cancelledAt: readString(row, "cancelled_at", "cancelledAt") || null,
    cancelledByUserId:
      readString(row, "cancelled_by_user_id", "cancelledByUserId") || null,
    cancelledByUserEmail:
      readString(row, "cancelled_by_user_email", "cancelledByUserEmail") || null,
    reactivatedAt: readString(row, "reactivated_at", "reactivatedAt") || null,
    reactivatedByUserId:
      readString(row, "reactivated_by_user_id", "reactivatedByUserId") || null,
    reactivatedByUserEmail:
      readString(row, "reactivated_by_user_email", "reactivatedByUserEmail") || null,
    deliveryType,
    deliveryNeighborhoodId:
      readString(row, "delivery_neighborhood_id", "deliveryNeighborhoodId") || undefined,
    deliveryNeighborhoodName:
      readString(row, "delivery_neighborhood_name", "deliveryNeighborhoodName") ||
      undefined,
    deliveryReference:
      readString(row, "delivery_reference", "deliveryReference") || undefined,
    deliveryQuoteContext: mapLocalDeliveryQuoteContext(
      row.delivery_quote_context ?? row.deliveryQuoteContext,
    ),
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

export function isValidNullableFiadoStatus(
  value: unknown,
): value is FiadoStatus | null {
  return value === null || isValidFiadoStatus(value);
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
