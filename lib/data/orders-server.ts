import {
  calculateOrderProductsTotal,
  createInitialOrderHistory,
  getInitialOrderState,
  isValidOrderStatus,
  isValidPaymentMethod,
  isValidPaymentStatus,
  isValidDeliveryType,
  isValidOrderProducts,
  mapSupabaseRowToOrder,
  normalizeOrderHistoryEvents,
  normalizeOrderApiUpdatePayload,
  type OrderApiCreatePayload,
  type OrderApiUpdatePayload,
} from "@/lib/orders/mappers";
import { debugError, debugLog } from "@/lib/debug";
import { assertOrderUpdateTransitionAllowed } from "@/lib/orders/update-guards";
import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
  getSupabaseServerAuthMode,
} from "@/lib/supabase/server";
import type { Order } from "@/types/orders";

interface BusinessLookupRow {
  id: string;
  slug: string;
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

function validateCreateOrderPayload(payload: unknown): payload is OrderApiCreatePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<OrderApiCreatePayload>;

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
    (candidate.status === undefined || isValidOrderStatus(candidate.status)) &&
    (candidate.paymentStatus === undefined || isValidPaymentStatus(candidate.paymentStatus)) &&
    (candidate.isReviewed === undefined || typeof candidate.isReviewed === "boolean") &&
    (candidate.dateLabel === undefined || typeof candidate.dateLabel === "string") &&
    (candidate.history === undefined || Array.isArray(candidate.history))
  );
}

function describePayloadProblems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ["El payload debe ser un objeto JSON valido."];
  }

  const candidate = payload as Partial<OrderApiCreatePayload>;
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

  if (candidate.status !== undefined && !isValidOrderStatus(candidate.status)) {
    problems.push("status no es valido para public.orders.");
  }

  if (
    candidate.paymentStatus !== undefined &&
    !isValidPaymentStatus(candidate.paymentStatus)
  ) {
    problems.push("paymentStatus no es valido para public.orders.");
  }

  if (candidate.isReviewed !== undefined && typeof candidate.isReviewed !== "boolean") {
    problems.push("isReviewed debe ser booleano.");
  }

  if (candidate.dateLabel !== undefined && typeof candidate.dateLabel !== "string") {
    problems.push("dateLabel debe ser texto cuando se envia.");
  }

  if (candidate.history !== undefined && !Array.isArray(candidate.history)) {
    problems.push("history debe ser un arreglo.");
  }

  return problems;
}

export async function getBusinessDatabaseRecordBySlug(slug: string) {
  const supabase = createServerSupabasePublicClient();
  const { data, error } = await supabase.rpc("get_storefront_business_by_slug", {
    requested_slug: slug,
  });

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return Array.isArray(data) ? ((data[0] as BusinessLookupRow | undefined) ?? null) : null;
}

async function getAuthenticatedBusinessDatabaseRecordBySlug(slug: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle<BusinessLookupRow>();

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return data;
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

function normalizeHistoryForPersistence(
  history: unknown,
  fallbackHistory?: Order["history"],
): Order["history"] {
  if (history === undefined) {
    return fallbackHistory ?? [];
  }

  if (!Array.isArray(history)) {
    throw new Error("Invalid order payload. history debe ser un arreglo de eventos validos.");
  }

  const normalizedHistory = normalizeOrderHistoryEvents(history);

  if (normalizedHistory.length !== history.length) {
    throw new Error(
      "Invalid order payload. history debe contener eventos validos con id, title y occurredAt.",
    );
  }

  const uniqueEventIds = new Set<string>();

  for (const historyEvent of normalizedHistory) {
    if (uniqueEventIds.has(historyEvent.id)) {
      throw new Error("Invalid order payload. history contiene eventos repetidos.");
    }

    uniqueEventIds.add(historyEvent.id);
  }

  return normalizedHistory;
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

  if (!business) {
    throw new Error(`Business not found for slug "${businessSlug}".`);
  }

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

export async function createOrderInDatabase(payload: unknown): Promise<Order> {
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

  const business = await getBusinessDatabaseRecordBySlug(payload.businessSlug);

  if (!business) {
    throw new Error(`Business not found for slug "${payload.businessSlug}".`);
  }

  const normalizedProducts = normalizeOrderProductsForPersistence(
    payload.products,
    await getBusinessProductsForOrder(business.id, { mode: "public" }),
    { requireActiveLinkedProducts: true },
  );

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const initialState = getInitialOrderState(payload.paymentMethod);
  const history =
    payload.history !== undefined && payload.history.length > 0
      ? normalizeHistoryForPersistence(payload.history)
      : createInitialOrderHistory(orderId, payload.businessSlug, now);
  const persistedTotal = assertOrderTotalMatchesProducts(payload.total, normalizedProducts);

  debugLog("[orders-api] Preparing order insert", {
    authMode: getSupabaseServerAuthMode("public"),
    businessSlug: payload.businessSlug,
    productsCount: normalizedProducts.length,
  });

  const publicSupabase = createServerSupabasePublicClient();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderCode = generateUniqueOrderCode();
    const insertPayload = {
      id: orderId,
      order_code: orderCode,
      business_id: business.id,
      customer_id: null,
      customer_name: payload.customerName.trim(),
      customer_whatsapp: payload.customerWhatsApp.trim(),
      delivery_type: payload.deliveryType,
      delivery_address: payload.deliveryAddress?.trim() || null,
      payment_method: payload.paymentMethod,
      notes: payload.notes?.trim() || null,
      total: persistedTotal,
      status: payload.status ?? initialState.status,
      created_at: now,
      updated_at: now,
      products: normalizedProducts,
      payment_status: payload.paymentStatus ?? initialState.paymentStatus,
      date_label: payload.dateLabel ?? null,
      is_reviewed: payload.isReviewed ?? false,
      history,
      inserted_at: now,
    };
    const { error } = await publicSupabase.from("orders").insert(insertPayload);

    if (!error) {
      return buildPersistedInsertedOrder(insertPayload, payload.businessSlug);
    }

    if (error.code === "23505" && error.message.includes("order_code")) {
      continue;
    }

    debugError("[orders-api] Supabase insert failed", {
      authMode: getSupabaseServerAuthMode("public"),
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
    (candidate.history === undefined || Array.isArray(candidate.history)) &&
    Object.keys(candidate).some((key) =>
      [
        "status",
        "paymentStatus",
        "customerName",
        "customerWhatsApp",
        "deliveryType",
        "deliveryAddress",
        "paymentMethod",
        "products",
        "notes",
        "total",
        "isReviewed",
        "history",
      ].includes(key),
    )
  );
}

function describeUpdatePayloadProblems(payload: unknown) {
  const normalizedPayload = normalizeOrderApiUpdatePayload(payload);

  if (!normalizedPayload || typeof normalizedPayload !== "object") {
    return ["El payload debe ser un objeto JSON valido."];
  }

  const candidate = normalizedPayload as Partial<OrderApiUpdatePayload>;
  const problems: string[] = [];
  const allowedKeys = [
    "status",
    "paymentStatus",
    "customerName",
    "customerWhatsApp",
    "deliveryType",
    "deliveryAddress",
    "paymentMethod",
    "products",
    "notes",
    "total",
    "isReviewed",
    "history",
  ];
  const receivedKeys = Object.keys(candidate);

  if (receivedKeys.length === 0) {
    problems.push("Debes enviar al menos un campo editable.");
  }

  if (receivedKeys.some((key) => !allowedKeys.includes(key))) {
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

  if (candidate.history !== undefined && !Array.isArray(candidate.history)) {
    problems.push("history debe ser un arreglo.");
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
      "id, business_id, customer_name, customer_whatsapp, delivery_type, delivery_address, payment_method, products, total, notes, status, payment_status",
    )
    .eq("id", orderId)
    .maybeSingle<OrderLookupRow>();

  if (lookupError) {
    throw new Error(`Supabase order lookup failed: ${lookupError.message}`);
  }

  if (!existingOrder) {
    throw new Error(`Order not found for id "${orderId}".`);
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
    normalizedPayload.products !== undefined ? normalizedPayload.products : existingOrder.products;

  assertOrderUpdateTransitionAllowed(
    {
      status: existingOrder.status,
      paymentStatus: existingOrder.payment_status,
    },
    normalizedPayload,
  );

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
  const normalizedHistory =
    normalizedPayload.history !== undefined
      ? normalizeHistoryForPersistence(normalizedPayload.history)
      : undefined;

  if (normalizedPayload.history !== undefined && normalizedHistory?.length === 0) {
    throw new Error(
      "Invalid order update payload. history debe conservar al menos un evento valido.",
    );
  }

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
    ...(normalizedPayload.status !== undefined ? { status: normalizedPayload.status } : {}),
    ...(normalizedPayload.paymentStatus !== undefined
      ? { payment_status: normalizedPayload.paymentStatus }
      : {}),
    ...(normalizedPayload.customerName !== undefined
      ? { customer_name: nextCustomerName }
      : {}),
    ...(normalizedPayload.customerWhatsApp !== undefined
      ? { customer_whatsapp: nextCustomerWhatsApp || null }
      : {}),
    ...(normalizedPayload.deliveryType !== undefined
      ? { delivery_type: normalizedPayload.deliveryType }
      : {}),
    ...(normalizedPayload.deliveryAddress !== undefined
      ? { delivery_address: nextDeliveryAddress || null }
      : {}),
    ...(normalizedPayload.paymentMethod !== undefined
      ? { payment_method: normalizedPayload.paymentMethod }
      : {}),
    ...(normalizedProducts !== undefined ? { products: normalizedProducts } : {}),
    ...(normalizedPayload.notes !== undefined
      ? { notes: normalizedPayload.notes?.trim() || null }
      : {}),
    ...(normalizedPayload.total !== undefined || normalizedPayload.products !== undefined
      ? { total: persistedTotal }
      : {}),
    ...(normalizedPayload.isReviewed !== undefined
      ? { is_reviewed: normalizedPayload.isReviewed }
      : {}),
    ...(normalizedHistory !== undefined ? { history: normalizedHistory } : {}),
    updated_at: new Date().toISOString(),
  };

  debugLog("[orders-api] Preparing order patch", {
    orderId,
    fieldsUpdated: Object.keys(updatePayload),
  });

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("*")
    .single();

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

  const businessSlug = await getBusinessSlugByDatabaseId(existingOrder.business_id);

  return mapSupabaseRowToOrder(data as Record<string, unknown>, {
    businessSlug: businessSlug ?? undefined,
  });
}
