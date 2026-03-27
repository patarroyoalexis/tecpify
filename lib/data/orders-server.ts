import {
  isValidOrderUpdateEventIntent,
  resolveOrderPersistenceMode,
  type OrderOrigin,
} from "@/lib/orders/history-rules";
import {
  calculateOrderProductsTotal,
  buildInitialOrderServerState,
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
  resolveAuthoritativeOrderStatePatch,
} from "@/lib/orders/state-rules";
import { getStorefrontBusinessLookupBySlug } from "@/data/businesses";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
  getSupabaseServerAuthMode,
} from "@/lib/supabase/server";
import type { Order } from "@/types/orders";

const ORDER_UPDATE_CLIENT_EDITABLE_FIELD_SET = new Set<string>(
  ORDER_UPDATE_CLIENT_EDITABLE_FIELDS,
);

interface BusinessLookupRow {
  id: string;
  slug: string;
  created_by_user_id: string | null;
  ownership_verified?: boolean;
}

interface BusinessSlugRow {
  slug: string;
}

interface OrderProductLookupRow {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface OrderLookupRow {
  id: string;
  business_id: string;
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
    history: Order["history"];
  },
  businessSlug: string,
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

export async function getBusinessDatabaseRecordBySlug(slug: string) {
  const storefrontLookup = await getStorefrontBusinessLookupBySlug(slug);
  const business = storefrontLookup.business;

  if (!business) {
    return null;
  }

  return {
    id: business.id,
    slug: business.slug,
    created_by_user_id: business.createdByUserId,
    ownership_verified: storefrontLookup.ownershipVerified,
  } satisfies BusinessLookupRow;
}

async function getAuthenticatedBusinessDatabaseRecordBySlug(slug: string) {
  const normalizedSlug = normalizeBusinessSlug(slug);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, created_by_user_id")
    .eq("slug", normalizedSlug)
    .maybeSingle<BusinessLookupRow>();

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return data;
}

function assertBusinessHasVerifiedOwner(
  business: BusinessLookupRow | null,
  options: { businessSlug: string },
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

async function getBusinessSlugByDatabaseId(businessDatabaseId: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessDatabaseId)
    .maybeSingle<BusinessSlugRow>();

  if (error) {
    throw new Error(`Supabase businesses slug query failed: ${error.message}`);
  }

  return data?.slug ?? null;
}

async function getBusinessProductsForOrder(
  businessDatabaseId: string,
  options?: { mode?: "public" | "auth" },
): Promise<OrderProductLookupRow[]> {
  const supabase =
    options?.mode === "auth"
      ? await createServerSupabaseAuthClient()
      : createServerSupabasePublicClient();
  let query = supabase
    .from("products")
    .select("id, name, price, is_available")
    .eq("business_id", businessDatabaseId);

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
  const productsById = new Map(availableProducts.map((product) => [product.id, product]));
  const linkedProductIds = new Set<string>();

  return products.map((product) => {
    const normalizedName = product.name.trim();

    if (!product.productId) {
      return {
        name: normalizedName,
        quantity: product.quantity,
        ...(product.unitPrice !== undefined ? { unitPrice: product.unitPrice } : {}),
      };
    }

    const catalogProduct = productsById.get(product.productId);

    if (!catalogProduct) {
      throw new Error(`Invalid order payload. productId "${product.productId}" no existe.`);
    }

    if (linkedProductIds.has(product.productId)) {
      throw new Error(
        `Invalid order payload. productId "${product.productId}" esta repetido dentro del mismo pedido.`,
      );
    }

    if (options?.requireActiveLinkedProducts && !catalogProduct.is_available) {
      throw new Error(
        `Invalid order payload. productId "${product.productId}" no esta activo para nuevos pedidos.`,
      );
    }

    linkedProductIds.add(product.productId);

    return {
      productId: catalogProduct.id,
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
  const business = await getAuthenticatedBusinessDatabaseRecordBySlug(businessSlug);
  assertBusinessHasVerifiedOwner(business, { businessSlug });

  return getOrdersByBusinessIdFromDatabase(business.id, { businessSlug });
}

export async function getOrdersByBusinessIdFromDatabase(
  businessId: string,
  options?: { businessSlug?: string },
): Promise<Order[]> {
  if (typeof businessId !== "string" || businessId.trim().length === 0) {
    throw new Error("Business id is required to load orders.");
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", businessId)
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
  options?: { origin?: OrderOrigin; businessId?: string },
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
  let businessId = options?.businessId;

  if (!businessId) {
    const business = await getBusinessDatabaseRecordBySlug(payload.businessSlug);
    assertBusinessHasVerifiedOwner(business, { businessSlug: payload.businessSlug });
    businessId = business.id;
  }

  const normalizedProducts = normalizeOrderProductsForPersistence(
    payload.products,
    await getBusinessProductsForOrder(businessId, { mode: orderCreationMode }),
    { requireActiveLinkedProducts: true },
  );

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const initialServerState = buildInitialOrderServerState({
    orderId,
    businessSlug: payload.businessSlug,
    createdAt: now,
    deliveryType: payload.deliveryType,
    paymentMethod: payload.paymentMethod,
    origin: orderOrigin,
  });
  const persistedTotal = assertOrderTotalMatchesProducts(payload.total, normalizedProducts);

  debugLog("[orders-api] Preparing order insert", {
    authMode: getSupabaseServerAuthMode(orderCreationMode),
    businessSlug: payload.businessSlug,
    orderOrigin,
    productsCount: normalizedProducts.length,
  });

  const supabase =
    orderCreationMode === "auth"
      ? await createServerSupabaseAuthClient()
      : createServerSupabasePublicClient();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = generateUniqueOrderCode();
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
          businessSlug: payload.businessSlug,
        });
      }

      return buildPersistedInsertedOrder(
        {
          ...insertPayload,
          status: initialServerState.status,
          payment_status: initialServerState.paymentStatus,
          history: initialServerState.history,
        },
        payload.businessSlug,
      );
    }

    if (error.code === "23505" && error.message.includes("order_code")) {
      continue;
    }

    debugError("[orders-api] Supabase insert failed", {
      authMode: getSupabaseServerAuthMode(orderCreationMode),
      businessSlug: payload.businessSlug,
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
  orderId: string,
  payload: unknown,
): Promise<Order> {
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
      "id, business_id, customer_name, customer_whatsapp, delivery_type, delivery_address, payment_method, products, total, notes, status, payment_status, is_reviewed",
    )
    .eq("id", orderId)
    .maybeSingle<OrderLookupRow>();

  if (lookupError) {
    throw new Error(`Supabase order lookup failed: ${lookupError.message}`);
  }

  if (!existingOrder) {
    throw new Error(`Order not found for id "${orderId}".`);
  }

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
  );
  const nextOrderState = resolvedStatePatch.nextState;

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
    normalizedPayload.products !== undefined ? normalizedPayload.products : existingOrder.products;
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

  const updatePayload = {
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
  };

  debugLog("[orders-api] Preparing order patch", {
    orderId,
    fieldsUpdated: Object.keys(updatePayload),
  });

  const { data, error } = await supabase.rpc("update_order_with_server_history", {
    target_order_id: orderId,
    patch: updatePayload,
  });

  if (error) {
    debugError("[orders-api] Supabase patch failed", {
      orderId,
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
