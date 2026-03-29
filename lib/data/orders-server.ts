import {
  isValidOrderUpdateEventIntent,
  resolveOrderPersistenceMode,
  type OrderOrigin,
} from "@/lib/orders/history-rules";
import {
  calculateOrderProductsTotal,
  buildInitialOrderServerState,
  isValidNullableFiadoStatus,
  isValidOrderStatus,
  isValidPaymentMethod,
  isValidPaymentStatus,
  isValidDeliveryType,
  isValidOrderProducts,
  mapSupabaseRowToOrder,
  normalizeOrderApiUpdatePayload,
  type PublicOrderApiCreatePayload,
  type OrderApiUpdatePayload,
} from "@/lib/orders/mappers";
import { debugError, debugLog } from "@/lib/debug";
import { hasVerifiedBusinessOwner } from "@/lib/auth/business-access";
import {
  ORDER_UPDATE_CLIENT_EDITABLE_FIELDS,
  getOrderPaymentMethodDeliveryTypeError,
  resolveAuthoritativeOrderFiadoPatch,
  resolveAuthoritativeOrderStatePatch,
} from "@/lib/orders/state-rules";
import {
  getCancelOrderError,
  getReactivateOrderError,
  normalizeCancellationDetail,
} from "@/lib/orders/cancellation-rules";
import {
  getBusinessPaymentMethodAvailabilityError,
  readBusinessPaymentSettings,
} from "@/lib/businesses/payment-settings";
import { getStorefrontBusinessLookupBySlug } from "@/data/businesses";
import { requireBusinessSlug } from "@/lib/businesses/slug";
import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
  getSupabaseServerAuthMode,
} from "@/lib/supabase/server";
import {
  requireBusinessId,
  requireOrderCode,
  requireOrderId,
  requireProductId,
  type BusinessId,
  type BusinessSlug,
  type OrderId,
  type ProductId,
} from "@/types/identifiers";
import type { Order, PaymentMethod } from "@/types/orders";

const ORDER_UPDATE_CLIENT_EDITABLE_FIELD_SET = new Set<string>(
  ORDER_UPDATE_CLIENT_EDITABLE_FIELDS,
);

interface BusinessLookupRow {
  id: BusinessId;
  slug: BusinessSlug;
  created_by_user_id: string | null;
  accepts_cash?: boolean | null;
  accepts_transfer?: boolean | null;
  accepts_card?: boolean | null;
  allows_fiado?: boolean | null;
  ownership_verified?: boolean;
}

interface BusinessSlugRow {
  slug: BusinessSlug;
}

interface OrderProductLookupRow {
  id: ProductId;
  name: string;
  price: number;
  is_available: boolean;
}

interface OrderLookupRow {
  id: OrderId;
  business_id: BusinessId;
  customer_name: string;
  customer_whatsapp: string | null;
  delivery_type: Order["deliveryType"];
  delivery_address: string | null;
  payment_method: Order["paymentMethod"];
  products: Order["products"];
  total: number;
  notes: string | null;
  status: Order["status"];
  payment_status: Order["paymentStatus"];
  is_reviewed: boolean;
  is_fiado: boolean;
  fiado_status: Order["fiadoStatus"];
  fiado_observation: string | null;
  previous_status_before_cancellation: Order["previousStatusBeforeCancellation"];
  cancellation_reason: Order["cancellationReason"];
  cancellation_detail: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancelled_by_user_email: string | null;
  reactivated_at: string | null;
  reactivated_by_user_id: string | null;
  reactivated_by_user_email: string | null;
}

interface UpdateOrderActorOptions {
  actorUserId?: string | null;
  actorEmail?: string | null;
}

function assertBusinessPaymentMethodIsEnabled(
  paymentMethod: PaymentMethod,
  business: Pick<
    BusinessLookupRow,
    "accepts_cash" | "accepts_transfer" | "accepts_card" | "allows_fiado"
  >,
) {
  const availabilityError = getBusinessPaymentMethodAvailabilityError(
    readBusinessPaymentSettings({
      acceptsCash: business.accepts_cash ?? true,
      acceptsTransfer: business.accepts_transfer ?? true,
      acceptsCard: business.accepts_card ?? true,
      allowsFiado: business.allows_fiado ?? false,
    }),
    paymentMethod,
  );

  if (availabilityError) {
    throw new Error(`Invalid order payload. ${availabilityError}`);
  }
}

function buildPersistedInsertedOrder(
  insertPayload: {
    id: string;
    order_code: string;
    customer_name: string;
    customer_whatsapp: string | null;
    delivery_type: Order["deliveryType"];
    delivery_address: string | null;
    payment_method: Order["paymentMethod"];
    products: Order["products"];
    total: number;
    notes: string | null;
    status: Order["status"];
    created_at: string;
    updated_at: string;
    payment_status: Order["paymentStatus"];
    date_label: string | null;
    is_reviewed: boolean;
    is_fiado: boolean;
    fiado_status: Order["fiadoStatus"];
    fiado_observation: string | null;
    previous_status_before_cancellation: Order["previousStatusBeforeCancellation"];
    cancellation_reason: Order["cancellationReason"];
    cancellation_detail: string | null;
    cancelled_at: string | null;
    cancelled_by_user_id: string | null;
    cancelled_by_user_email: string | null;
    reactivated_at: string | null;
    reactivated_by_user_id: string | null;
    reactivated_by_user_email: string | null;
    history: Order["history"];
  },
  businessSlug: BusinessSlug,
) {
  return mapSupabaseRowToOrder(insertPayload as Record<string, unknown>, {
    businessSlug,
  });
}

function generateCandidateOrderCode() {
  return `WEB-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateUniqueOrderCode() {
  return generateCandidateOrderCode();
}

function validateCreateOrderPayload(payload: unknown): payload is PublicOrderApiCreatePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<PublicOrderApiCreatePayload>;

  return (
    typeof candidate.businessSlug === "string" &&
    candidate.businessSlug.trim().length > 0 &&
    typeof candidate.customerName === "string" &&
    candidate.customerName.trim().length > 0 &&
    typeof candidate.customerWhatsApp === "string" &&
    candidate.customerWhatsApp.trim().length > 0 &&
    typeof candidate.paymentMethod === "string" &&
    isValidDeliveryType(candidate.deliveryType) &&
    isValidOrderProducts(candidate.products) &&
    typeof candidate.total === "number" &&
    Number.isFinite(candidate.total) &&
    candidate.total > 0 &&
    (candidate.deliveryAddress === undefined ||
      typeof candidate.deliveryAddress === "string") &&
    (candidate.notes === undefined || typeof candidate.notes === "string")
  );
}

function describePayloadProblems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ["El payload debe ser un objeto JSON valido."];
  }

  const candidate = payload as Partial<PublicOrderApiCreatePayload>;
  const problems: string[] = [];

  if (typeof candidate.businessSlug !== "string" || candidate.businessSlug.trim().length === 0) {
    problems.push("businessSlug es obligatorio.");
  }

  if (typeof candidate.customerName !== "string" || candidate.customerName.trim().length === 0) {
    problems.push("customerName es obligatorio.");
  }

  if (
    typeof candidate.customerWhatsApp !== "string" ||
    candidate.customerWhatsApp.trim().length === 0
  ) {
    problems.push("customerWhatsApp es obligatorio.");
  }

  if (typeof candidate.paymentMethod !== "string" || candidate.paymentMethod.trim().length === 0) {
    problems.push("paymentMethod es obligatorio.");
  }

  if (!isValidDeliveryType(candidate.deliveryType)) {
    problems.push("deliveryType debe ser 'domicilio' o 'recogida en tienda'.");
  }

  if (!isValidOrderProducts(candidate.products)) {
    problems.push("products debe contener al menos un producto valido.");
  }

  if (
    typeof candidate.total !== "number" ||
    !Number.isFinite(candidate.total) ||
    candidate.total <= 0
  ) {
    problems.push("total debe ser un numero mayor que 0.");
  }

  if (
    candidate.deliveryType === "domicilio" &&
    (typeof candidate.deliveryAddress !== "string" || candidate.deliveryAddress.trim().length === 0)
  ) {
    problems.push("deliveryAddress es obligatoria para pedidos a domicilio.");
  }

  if (
    candidate.deliveryAddress !== undefined &&
    typeof candidate.deliveryAddress !== "string"
  ) {
    problems.push("deliveryAddress debe ser texto cuando se envia.");
  }

  if (candidate.notes !== undefined && typeof candidate.notes !== "string") {
    problems.push("notes debe ser texto cuando se envia.");
  }

  return problems;
}

export async function getBusinessDatabaseRecordBySlug(businessSlug: string) {
  const storefrontLookup = await getStorefrontBusinessLookupBySlug(businessSlug);
  const business = storefrontLookup.business;

  if (!business) {
    return null;
  }

  return {
    id: business.businessId,
    slug: business.businessSlug,
    created_by_user_id: business.createdByUserId,
    accepts_cash: business.acceptsCash,
    accepts_transfer: business.acceptsTransfer,
    accepts_card: business.acceptsCard,
    allows_fiado: business.allowsFiado,
    ownership_verified: storefrontLookup.ownershipVerified,
  } satisfies BusinessLookupRow;
}

async function getAuthenticatedBusinessDatabaseRecordBySlug(businessSlug: string) {
  const normalizedBusinessSlug = requireBusinessSlug(businessSlug);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, created_by_user_id, accepts_cash, accepts_transfer, accepts_card, allows_fiado",
    )
    .eq("slug", normalizedBusinessSlug)
    .maybeSingle<BusinessLookupRow>();

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return data;
}

function assertBusinessHasVerifiedOwner(
  business: BusinessLookupRow | null,
  options: { businessSlug: BusinessSlug },
): asserts business is BusinessLookupRow {
  if (!business) {
    throw new Error(`Business not found for slug "${options.businessSlug}".`);
  }

  if (business.ownership_verified === true) {
    return;
  }

  if (!hasVerifiedBusinessOwner(business.created_by_user_id)) {
    throw new Error(
      `Business "${options.businessSlug}" is blocked until it has a real owner in created_by_user_id.`,
    );
  }
}

async function getBusinessSlugByDatabaseId(businessDatabaseId: BusinessId) {
  const normalizedBusinessId = requireBusinessId(businessDatabaseId);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", normalizedBusinessId)
    .maybeSingle<BusinessSlugRow>();

  if (error) {
    throw new Error(`Supabase businesses slug query failed: ${error.message}`);
  }

  return data?.slug ? requireBusinessSlug(data.slug) : null;
}

async function getBusinessPaymentSettingsByDatabaseId(businessDatabaseId: BusinessId) {
  const normalizedBusinessId = requireBusinessId(businessDatabaseId);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("accepts_cash, accepts_transfer, accepts_card, allows_fiado")
    .eq("id", normalizedBusinessId)
    .maybeSingle<BusinessLookupRow>();

  if (error) {
    throw new Error(`Supabase businesses payment settings query failed: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Business not found for id "${normalizedBusinessId}".`);
  }

  return data;
}

async function getBusinessProductsForOrder(
  businessDatabaseId: BusinessId,
  options?: { mode?: "public" | "auth" },
): Promise<OrderProductLookupRow[]> {
  const normalizedBusinessId = requireBusinessId(businessDatabaseId);
  const supabase =
    options?.mode === "auth"
      ? await createServerSupabaseAuthClient()
      : createServerSupabasePublicClient();
  let query = supabase
    .from("products")
    .select("id, name, price, is_available")
    .eq("business_id", normalizedBusinessId);

  if (options?.mode !== "auth") {
    query = query.eq("is_available", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase products lookup failed: ${error.message}`);
  }

  return (data ?? []) as OrderProductLookupRow[];
}

function normalizeOrderProductsForPersistence(
  products: Order["products"],
  availableProducts: OrderProductLookupRow[],
  options?: { requireActiveLinkedProducts?: boolean },
) {
  const productsById = new Map(
    availableProducts.map((product) => [requireProductId(product.id), product]),
  );
  const linkedProductIds = new Set<ProductId>();

  return products.map((product) => {
    const normalizedName = product.name.trim();

    if (!product.productId) {
      return {
        name: normalizedName,
        quantity: product.quantity,
        ...(product.unitPrice !== undefined ? { unitPrice: product.unitPrice } : {}),
      };
    }

    const normalizedProductId = requireProductId(product.productId);
    const catalogProduct = productsById.get(normalizedProductId);

    if (!catalogProduct) {
      throw new Error(`Invalid order payload. productId "${normalizedProductId}" no existe.`);
    }

    if (linkedProductIds.has(normalizedProductId)) {
      throw new Error(
        `Invalid order payload. productId "${normalizedProductId}" esta repetido dentro del mismo pedido.`,
      );
    }

    if (options?.requireActiveLinkedProducts && !catalogProduct.is_available) {
      throw new Error(
        `Invalid order payload. productId "${normalizedProductId}" no esta activo para nuevos pedidos.`,
      );
    }

    linkedProductIds.add(normalizedProductId);

    return {
      productId: requireProductId(catalogProduct.id),
      name: normalizedName || catalogProduct.name,
      quantity: product.quantity,
      unitPrice:
        product.unitPrice !== undefined && Number.isFinite(product.unitPrice)
          ? product.unitPrice
          : catalogProduct.price,
    };
  });
}

function assertOrderTotalMatchesProducts(
  total: number,
  products: Order["products"],
  options?: { allowZero?: boolean },
) {
  const expectedTotal = calculateOrderProductsTotal(products);
  const minimumAllowedTotal = options?.allowZero ? 0 : 0.01;

  if (expectedTotal < minimumAllowedTotal) {
    throw new Error("Invalid order payload. products debe producir un total valido.");
  }

  if (Math.abs(expectedTotal - total) > 0.001) {
    throw new Error(
      `Invalid order payload. total no coincide con la suma real de los productos (${expectedTotal}).`,
    );
  }

  return expectedTotal;
}

export async function getOrdersByBusinessSlugFromDatabase(
  businessSlug: string,
): Promise<Order[]> {
  const normalizedBusinessSlug = requireBusinessSlug(businessSlug);
  const business = await getAuthenticatedBusinessDatabaseRecordBySlug(normalizedBusinessSlug);
  assertBusinessHasVerifiedOwner(business, { businessSlug: normalizedBusinessSlug });

  return getOrdersByBusinessIdFromDatabase(business.id, {
    businessSlug: normalizedBusinessSlug,
  });
}

export async function getOrdersByBusinessIdFromDatabase(
  businessId: BusinessId,
  options?: { businessSlug?: BusinessSlug },
): Promise<Order[]> {
  const normalizedBusinessId = requireBusinessId(businessId);

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", normalizedBusinessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase orders query failed: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapSupabaseRowToOrder(row as Record<string, unknown>, {
      ...(options?.businessSlug ? { businessSlug: options.businessSlug } : {}),
    }),
  );
}

export async function createOrderInDatabase(
  payload: unknown,
  options?: { origin?: OrderOrigin; businessId?: BusinessId },
): Promise<Order> {
  if (!validateCreateOrderPayload(payload)) {
    throw new Error(`Invalid order payload. ${describePayloadProblems(payload).join(" ")}`);
  }

  if (
    payload.deliveryType === "domicilio" &&
    (!payload.deliveryAddress || payload.deliveryAddress.trim().length === 0)
  ) {
    throw new Error(
      "Invalid order payload. deliveryAddress es obligatoria para pedidos a domicilio.",
    );
  }

  const paymentMethodDeliveryTypeError = getOrderPaymentMethodDeliveryTypeError(
    payload.deliveryType,
    payload.paymentMethod,
  );

  if (paymentMethodDeliveryTypeError) {
    throw new Error(`Invalid order payload. ${paymentMethodDeliveryTypeError}`);
  }

  const orderOrigin = options?.origin ?? "public_form";
  const orderCreationMode = resolveOrderPersistenceMode(orderOrigin);
  const normalizedBusinessSlug = requireBusinessSlug(payload.businessSlug);
  let businessId = options?.businessId ? requireBusinessId(options.businessId) : null;
  let businessPaymentSettings: BusinessLookupRow | null = null;

  if (!businessId) {
    const business = await getBusinessDatabaseRecordBySlug(normalizedBusinessSlug);
    assertBusinessHasVerifiedOwner(business, { businessSlug: normalizedBusinessSlug });
    businessId = business.id;
    businessPaymentSettings = business;
  } else {
    businessPaymentSettings = await getBusinessPaymentSettingsByDatabaseId(businessId);
  }

  assertBusinessPaymentMethodIsEnabled(payload.paymentMethod, businessPaymentSettings);

  const normalizedProducts = normalizeOrderProductsForPersistence(
    payload.products,
    await getBusinessProductsForOrder(businessId, { mode: orderCreationMode }),
    { requireActiveLinkedProducts: true },
  );

  const now = new Date().toISOString();
  const orderId = requireOrderId(crypto.randomUUID());
  const initialServerState = buildInitialOrderServerState({
    orderId,
    businessSlug: normalizedBusinessSlug,
    createdAt: now,
    deliveryType: payload.deliveryType,
    paymentMethod: payload.paymentMethod,
    origin: orderOrigin,
  });
  const persistedTotal = assertOrderTotalMatchesProducts(payload.total, normalizedProducts);

  debugLog("[orders-api] Preparing order insert", {
    authMode: getSupabaseServerAuthMode(orderCreationMode),
    businessSlug: normalizedBusinessSlug,
    orderOrigin,
    productsCount: normalizedProducts.length,
  });

  const supabase =
    orderCreationMode === "auth"
      ? await createServerSupabaseAuthClient()
      : createServerSupabasePublicClient();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = requireOrderCode(generateUniqueOrderCode());
    const insertPayload = {
      id: orderId,
      order_code: orderCode,
      business_id: businessId,
      customer_id: null,
      customer_name: payload.customerName.trim(),
      customer_whatsapp: payload.customerWhatsApp.trim(),
      delivery_type: payload.deliveryType,
      delivery_address: payload.deliveryAddress?.trim() || null,
      payment_method: payload.paymentMethod,
      notes: payload.notes?.trim() || null,
      total: persistedTotal,
      created_at: now,
      updated_at: now,
      products: normalizedProducts,
      date_label: null,
      is_reviewed: false,
      is_fiado: false,
      fiado_status: null,
      fiado_observation: null,
      inserted_at: now,
    };
    const insertQuery = supabase.from("orders").insert(insertPayload);
    const { data, error } =
      orderCreationMode === "auth"
        ? await insertQuery.select("*").single()
        : await insertQuery;

    if (!error) {
      if (orderCreationMode === "auth" && data) {
        return mapSupabaseRowToOrder(data as Record<string, unknown>, {
          businessSlug: normalizedBusinessSlug,
        });
      }

      return buildPersistedInsertedOrder(
        {
          ...insertPayload,
          status: initialServerState.status,
          payment_status: initialServerState.paymentStatus,
          is_fiado: initialServerState.isFiado,
          fiado_status: initialServerState.fiadoStatus,
          fiado_observation: initialServerState.fiadoObservation,
          previous_status_before_cancellation: null,
          cancellation_reason: null,
          cancellation_detail: null,
          cancelled_at: null,
          cancelled_by_user_id: null,
          cancelled_by_user_email: null,
          reactivated_at: null,
          reactivated_by_user_id: null,
          reactivated_by_user_email: null,
          history: initialServerState.history,
        },
        normalizedBusinessSlug,
      );
    }

    if (error.code === "23505" && error.message.includes("order_code")) {
      continue;
    }

    debugError("[orders-api] Supabase insert failed", {
      authMode: getSupabaseServerAuthMode(orderCreationMode),
      businessSlug: normalizedBusinessSlug,
      code: error.code ?? null,
    });
    throw new Error(
      `No fue posible guardar el pedido en Supabase. Intenta de nuevo o recarga antes de reenviar. ${error.message}`,
    );
  }

  throw new Error(
    "No fue posible generar un codigo de pedido unico tras varios intentos. Intenta de nuevo.",
  );
}

function validateUpdateOrderPayload(payload: unknown): payload is OrderApiUpdatePayload {
  const normalizedPayload = normalizeOrderApiUpdatePayload(payload);

  if (!normalizedPayload || typeof normalizedPayload !== "object") {
    return false;
  }

  const candidate = normalizedPayload as Partial<OrderApiUpdatePayload>;

  return (
    (candidate.status === undefined || isValidOrderStatus(candidate.status)) &&
    (candidate.paymentStatus === undefined || isValidPaymentStatus(candidate.paymentStatus)) &&
    (candidate.customerName === undefined || typeof candidate.customerName === "string") &&
    (candidate.customerWhatsApp === undefined ||
      candidate.customerWhatsApp === null ||
      typeof candidate.customerWhatsApp === "string") &&
    (candidate.deliveryType === undefined || isValidDeliveryType(candidate.deliveryType)) &&
    (candidate.deliveryAddress === undefined ||
      candidate.deliveryAddress === null ||
      typeof candidate.deliveryAddress === "string") &&
    (candidate.paymentMethod === undefined || isValidPaymentMethod(candidate.paymentMethod)) &&
    (candidate.products === undefined || isValidOrderProducts(candidate.products)) &&
    (candidate.notes === undefined ||
      candidate.notes === null ||
      typeof candidate.notes === "string") &&
    (candidate.total === undefined ||
      (typeof candidate.total === "number" &&
        Number.isFinite(candidate.total) &&
        candidate.total >= 0)) &&
    (candidate.isReviewed === undefined || typeof candidate.isReviewed === "boolean") &&
    (candidate.isFiado === undefined || typeof candidate.isFiado === "boolean") &&
    (candidate.fiadoStatus === undefined ||
      isValidNullableFiadoStatus(candidate.fiadoStatus)) &&
    (candidate.fiadoObservation === undefined ||
      candidate.fiadoObservation === null ||
      typeof candidate.fiadoObservation === "string") &&
    (candidate.cancellationReason === undefined ||
      typeof candidate.cancellationReason === "string") &&
    (candidate.cancellationDetail === undefined ||
      candidate.cancellationDetail === null ||
      typeof candidate.cancellationDetail === "string") &&
    (candidate.reactivateCancelledOrder === undefined ||
      typeof candidate.reactivateCancelledOrder === "boolean") &&
    (candidate.eventIntent === undefined ||
      isValidOrderUpdateEventIntent(candidate.eventIntent)) &&
    Object.keys(candidate).length > 0 &&
    Object.keys(candidate).every((key) => ORDER_UPDATE_CLIENT_EDITABLE_FIELD_SET.has(key))
  );
}

function describeUpdatePayloadProblems(payload: unknown) {
  const normalizedPayload = normalizeOrderApiUpdatePayload(payload);

  if (!normalizedPayload || typeof normalizedPayload !== "object") {
    return ["El payload debe ser un objeto JSON valido."];
  }

  const rawCandidate = normalizedPayload as Record<string, unknown>;
  const candidate = normalizedPayload as Partial<OrderApiUpdatePayload>;
  const problems: string[] = [];
  const receivedKeys = Object.keys(candidate);

  if (receivedKeys.length === 0) {
    problems.push("Debes enviar al menos un campo editable.");
  }

  if (receivedKeys.some((key) => !ORDER_UPDATE_CLIENT_EDITABLE_FIELD_SET.has(key))) {
    problems.push("El payload contiene campos no permitidos.");
  }

  if (candidate.status !== undefined && !isValidOrderStatus(candidate.status)) {
    problems.push("status no es valido para public.orders.");
  }

  if (candidate.paymentStatus !== undefined && !isValidPaymentStatus(candidate.paymentStatus)) {
    problems.push("paymentStatus no es valido para public.orders.");
  }

  if (candidate.customerName !== undefined && candidate.customerName.trim().length === 0) {
    problems.push("customerName es obligatorio cuando se envia.");
  }

  if (
    candidate.customerWhatsApp !== undefined &&
    candidate.customerWhatsApp !== null &&
    candidate.customerWhatsApp.trim().length === 0
  ) {
    problems.push("customerWhatsApp es obligatorio cuando se envia.");
  }

  if (candidate.deliveryType !== undefined && !isValidDeliveryType(candidate.deliveryType)) {
    problems.push("deliveryType no es valido para public.orders.");
  }

  if (
    candidate.deliveryAddress !== undefined &&
    candidate.deliveryAddress !== null &&
    candidate.deliveryAddress.trim().length === 0
  ) {
    problems.push("deliveryAddress no puede enviarse vacia.");
  }

  if (candidate.paymentMethod !== undefined && !isValidPaymentMethod(candidate.paymentMethod)) {
    problems.push("paymentMethod no es valido para public.orders.");
  }

  if (candidate.products !== undefined && !isValidOrderProducts(candidate.products)) {
    problems.push("products debe contener al menos un producto valido.");
  }

  if (
    candidate.notes !== undefined &&
    candidate.notes !== null &&
    typeof candidate.notes === "string" &&
    candidate.notes.trim().length === 0
  ) {
    problems.push("notes no puede enviarse vacio cuando se incluye.");
  }

  if (
    candidate.total !== undefined &&
    (!Number.isFinite(candidate.total) || candidate.total < 0)
  ) {
    problems.push("total debe ser un numero mayor o igual a 0.");
  }

  if (candidate.isReviewed !== undefined && typeof candidate.isReviewed !== "boolean") {
    problems.push("isReviewed debe ser booleano.");
  }

  if (candidate.isFiado !== undefined && typeof candidate.isFiado !== "boolean") {
    problems.push("isFiado debe ser booleano.");
  }

  if (
    candidate.fiadoStatus !== undefined &&
    !isValidNullableFiadoStatus(candidate.fiadoStatus)
  ) {
    problems.push(
      'fiadoStatus debe ser "pending", "paid" o null.',
    );
  }

  if (
    candidate.fiadoObservation !== undefined &&
    candidate.fiadoObservation !== null &&
    typeof candidate.fiadoObservation !== "string"
  ) {
    problems.push("fiadoObservation debe ser texto o null.");
  }

  if (
    candidate.cancellationReason !== undefined &&
    typeof candidate.cancellationReason !== "string"
  ) {
    problems.push("cancellationReason debe ser texto.");
  }

  if (
    candidate.cancellationDetail !== undefined &&
    candidate.cancellationDetail !== null &&
    typeof candidate.cancellationDetail !== "string"
  ) {
    problems.push("cancellationDetail debe ser texto o null.");
  }

  if (
    candidate.reactivateCancelledOrder !== undefined &&
    typeof candidate.reactivateCancelledOrder !== "boolean"
  ) {
    problems.push("reactivateCancelledOrder debe ser booleano.");
  }

  if (candidate.eventIntent !== undefined && !isValidOrderUpdateEventIntent(candidate.eventIntent)) {
    problems.push("eventIntent no es valido para public.orders.");
  }

  if ("history" in rawCandidate) {
    problems.push(
      "history no acepta snapshots completos; el historial es append-only y se deriva en servidor.",
    );
  }

  return problems;
}

export async function updateOrderInDatabase(
  orderId: OrderId,
  payload: unknown,
  options?: UpdateOrderActorOptions,
): Promise<Order> {
  const normalizedOrderId = requireOrderId(orderId);
  const normalizedPayload = normalizeOrderApiUpdatePayload(payload);

  if (!validateUpdateOrderPayload(normalizedPayload)) {
    throw new Error(
      `Invalid order update payload. ${describeUpdatePayloadProblems(normalizedPayload).join(" ")}`,
    );
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data: existingOrder, error: lookupError } = await supabase
    .from("orders")
    .select(
      "id, business_id, customer_name, customer_whatsapp, delivery_type, delivery_address, payment_method, products, total, notes, status, payment_status, is_reviewed, is_fiado, fiado_status, fiado_observation, previous_status_before_cancellation, cancellation_reason, cancellation_detail, cancelled_at, cancelled_by_user_id, cancelled_by_user_email, reactivated_at, reactivated_by_user_id, reactivated_by_user_email",
    )
    .eq("id", normalizedOrderId)
    .maybeSingle<OrderLookupRow>();

  if (lookupError) {
    throw new Error(`Supabase order lookup failed: ${lookupError.message}`);
  }

  if (!existingOrder) {
    throw new Error(`Order not found for id "${normalizedOrderId}".`);
  }

  const businessPaymentSettings = await getBusinessPaymentSettingsByDatabaseId(
    existingOrder.business_id,
  );
  const receivedFields = Object.keys(normalizedPayload);
  const isCancellationOperation = normalizedPayload.status === "cancelado";
  const isReactivationOperation = normalizedPayload.reactivateCancelledOrder === true;

  if (isCancellationOperation && isReactivationOperation) {
    throw new Error(
      "Invalid order update payload. No puedes cancelar y reactivar el pedido en la misma operacion.",
    );
  }

  if (
    !isCancellationOperation &&
    !isReactivationOperation &&
    (normalizedPayload.cancellationReason !== undefined ||
      normalizedPayload.cancellationDetail !== undefined)
  ) {
    throw new Error(
      "Invalid order update payload. cancellationReason y cancellationDetail solo se admiten en la cancelacion excepcional.",
    );
  }

  if (isCancellationOperation) {
    const cancelError = getCancelOrderError(
      {
        status: existingOrder.status,
      },
      {
        status: normalizedPayload.status,
        cancellationReason: normalizedPayload.cancellationReason,
        cancellationDetail: normalizedPayload.cancellationDetail,
      },
      receivedFields,
    );

    if (cancelError) {
      throw new Error(`Invalid order update payload. ${cancelError}`);
    }
  }

  if (isReactivationOperation) {
    const reactivateError = getReactivateOrderError(
      {
        status: existingOrder.status,
        previousStatusBeforeCancellation:
          existingOrder.previous_status_before_cancellation,
      },
      {
        reactivateCancelledOrder: normalizedPayload.reactivateCancelledOrder,
      },
      receivedFields,
    );

    if (reactivateError) {
      throw new Error(`Invalid order update payload. ${reactivateError}`);
    }
  }

  if (
    existingOrder.status === "cancelado" &&
    !isReactivationOperation &&
    [
      "status",
      "paymentStatus",
      "payment_status",
      "paymentMethod",
      "deliveryType",
      "products",
      "total",
      "isFiado",
      "fiadoStatus",
      "fiadoObservation",
    ].some((field) => field in normalizedPayload)
  ) {
    throw new Error(
      "Invalid order update payload. Un pedido cancelado debe reactivarse antes de volver a mutar su frente operativo.",
    );
  }

  let updatePayload: Record<string, unknown>;

  if (isCancellationOperation) {
    updatePayload = {
      status: "cancelado",
      cancellationReason: normalizedPayload.cancellationReason ?? null,
      cancellationDetail: normalizeCancellationDetail(normalizedPayload.cancellationDetail),
    };
  } else if (isReactivationOperation) {
    updatePayload = {
      reactivateCancelledOrder: true,
    };
  } else {
    const resolvedFiadoPatch = resolveAuthoritativeOrderFiadoPatch(
      {
        isFiado: existingOrder.is_fiado,
        fiadoStatus: existingOrder.fiado_status,
        fiadoObservation: existingOrder.fiado_observation,
      },
      {
        isFiado: normalizedPayload.isFiado,
        fiadoStatus: normalizedPayload.fiadoStatus,
        fiadoObservation: normalizedPayload.fiadoObservation,
      },
      {
        allowsFiado: businessPaymentSettings.allows_fiado ?? false,
      },
    );
    const nextFiadoState = resolvedFiadoPatch.nextState;
    const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
      {
        deliveryType: existingOrder.delivery_type,
        paymentMethod: existingOrder.payment_method,
        paymentStatus: existingOrder.payment_status,
        status: existingOrder.status,
      },
      {
        deliveryType: normalizedPayload.deliveryType,
        paymentMethod: normalizedPayload.paymentMethod,
        paymentStatus: normalizedPayload.paymentStatus,
        status: normalizedPayload.status,
      },
      {
        isFiado: nextFiadoState.isFiado,
        fiadoStatus: nextFiadoState.fiadoStatus,
      },
    );
    const nextOrderState = resolvedStatePatch.nextState;

    if (
      normalizedPayload.paymentMethod !== undefined ||
      resolvedStatePatch.changedFields.includes("paymentMethod")
    ) {
      assertBusinessPaymentMethodIsEnabled(nextOrderState.paymentMethod, businessPaymentSettings);
    }

    const nextCustomerName =
      normalizedPayload.customerName !== undefined
        ? normalizedPayload.customerName.trim()
        : existingOrder.customer_name;
    const nextCustomerWhatsApp =
      normalizedPayload.customerWhatsApp !== undefined
        ? normalizedPayload.customerWhatsApp?.trim() || ""
        : existingOrder.customer_whatsapp ?? "";
    const nextDeliveryType =
      normalizedPayload.deliveryType !== undefined
        ? normalizedPayload.deliveryType
        : existingOrder.delivery_type;
    const nextDeliveryAddress =
      normalizedPayload.deliveryAddress !== undefined
        ? normalizedPayload.deliveryAddress?.trim() || ""
        : existingOrder.delivery_address ?? "";
    const nextTotal =
      normalizedPayload.total !== undefined ? normalizedPayload.total : existingOrder.total;
    const nextProducts =
      normalizedPayload.products !== undefined
        ? normalizedPayload.products
        : existingOrder.products;
    const nextIsReviewed =
      normalizedPayload.eventIntent === "mark_reviewed_from_operation" ||
      normalizedPayload.eventIntent === "mark_reviewed_from_new_orders"
        ? true
        : normalizedPayload.isReviewed ?? existingOrder.is_reviewed;

    if (nextCustomerName.length === 0) {
      throw new Error("Invalid order update payload. customerName is required.");
    }

    if (nextDeliveryType === "domicilio" && nextDeliveryAddress.length === 0) {
      throw new Error(
        "Invalid order update payload. deliveryAddress is required for domicilio orders.",
      );
    }

    if (nextTotal < 0) {
      throw new Error("Invalid order update payload. total must be greater than or equal to 0.");
    }

    if (!isValidOrderProducts(nextProducts)) {
      throw new Error(
        "Invalid order update payload. products must contain at least one valid product.",
      );
    }

    const normalizedProducts =
      normalizedPayload.products !== undefined
        ? normalizeOrderProductsForPersistence(
            normalizedPayload.products,
            await getBusinessProductsForOrder(existingOrder.business_id, { mode: "auth" }),
          )
        : undefined;

    const shouldValidatePersistedTotal =
      normalizedPayload.products !== undefined || normalizedPayload.total !== undefined;
    const persistedTotal = shouldValidatePersistedTotal
      ? assertOrderTotalMatchesProducts(
          nextTotal,
          normalizedProducts ?? existingOrder.products,
          { allowZero: true },
        )
      : nextTotal;

    updatePayload = {
      ...(resolvedStatePatch.changedFields.includes("status")
        ? { status: nextOrderState.status }
        : {}),
      ...(resolvedStatePatch.changedFields.includes("paymentStatus")
        ? { paymentStatus: nextOrderState.paymentStatus }
        : {}),
      ...(normalizedPayload.customerName !== undefined
        ? { customerName: nextCustomerName }
        : {}),
      ...(normalizedPayload.customerWhatsApp !== undefined
        ? { customerWhatsApp: nextCustomerWhatsApp || null }
        : {}),
      ...(normalizedPayload.deliveryType !== undefined
        ? { deliveryType: normalizedPayload.deliveryType }
        : {}),
      ...(normalizedPayload.deliveryAddress !== undefined
        ? { deliveryAddress: nextDeliveryAddress || null }
        : {}),
      ...(resolvedStatePatch.changedFields.includes("paymentMethod")
        ? { paymentMethod: nextOrderState.paymentMethod }
        : {}),
      ...(normalizedProducts !== undefined ? { products: normalizedProducts } : {}),
      ...(normalizedPayload.notes !== undefined
        ? { notes: normalizedPayload.notes?.trim() || null }
        : {}),
      ...(normalizedPayload.total !== undefined || normalizedPayload.products !== undefined
        ? { total: persistedTotal }
        : {}),
      ...(nextIsReviewed !== existingOrder.is_reviewed
        ? { isReviewed: nextIsReviewed }
        : {}),
      ...(resolvedFiadoPatch.changedFields.includes("isFiado")
        ? { isFiado: nextFiadoState.isFiado }
        : {}),
      ...(resolvedFiadoPatch.changedFields.includes("fiadoStatus")
        ? { fiadoStatus: nextFiadoState.fiadoStatus }
        : {}),
      ...(resolvedFiadoPatch.changedFields.includes("fiadoObservation")
        ? { fiadoObservation: nextFiadoState.fiadoObservation }
        : {}),
    };
  }

  if (options?.actorUserId) {
    updatePayload.actorUserId = options.actorUserId;
  }

  if (options?.actorEmail) {
    updatePayload.actorEmail = options.actorEmail;
  }

  debugLog("[orders-api] Preparing order patch", {
    orderId: normalizedOrderId,
    fieldsUpdated: Object.keys(updatePayload),
  });

  const { data, error } = await supabase.rpc("update_order_with_server_history", {
    target_order_id: normalizedOrderId,
    patch: updatePayload,
  });

  if (error) {
    debugError("[orders-api] Supabase patch failed", {
      orderId: normalizedOrderId,
      code: error.code ?? null,
      authMode: getSupabaseServerAuthMode("auth"),
    });
    throw new Error(
      `No fue posible actualizar el pedido en Supabase. Recarga la operacion e intenta de nuevo. ${error.message}`,
    );
  }

  const persistedOrder =
    Array.isArray(data) && data.length > 0 ? data[0] : data;

  if (!persistedOrder || typeof persistedOrder !== "object") {
    throw new Error(
      "No fue posible actualizar el pedido en Supabase. La funcion controlada no devolvio un pedido valido.",
    );
  }

  const businessSlug = await getBusinessSlugByDatabaseId(existingOrder.business_id);

  return mapSupabaseRowToOrder(persistedOrder as Record<string, unknown>, {
    businessSlug: businessSlug ?? undefined,
  });
}
