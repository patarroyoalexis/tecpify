import {
  createInitialOrderHistory,
  getInitialOrderState,
  isValidOrderStatus,
  isValidPaymentStatus,
  isValidDeliveryType,
  isValidOrderProducts,
  mapSupabaseRowToOrder,
  type OrderApiCreatePayload,
  type OrderApiUpdatePayload,
} from "@/lib/orders/mappers";
import { createServerSupabaseClient, getSupabaseServerAuthMode } from "@/lib/supabase/server";
import type { Order } from "@/types/orders";

interface BusinessLookupRow {
  id: string;
  slug: string;
}

interface BusinessSlugRow {
  slug: string;
}

interface OrderLookupRow {
  id: string;
  business_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  delivery_type: Order["deliveryType"];
  delivery_address: string | null;
  total: number;
  notes: string | null;
}

function generateCandidateOrderCode() {
  return `WEB-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function generateUniqueOrderCode() {
  const supabase = createServerSupabaseClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateCandidateOrderCode();
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("order_code", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase order_code lookup failed: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique order_code after multiple attempts.");
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
    (candidate.paymentStatus === undefined || isValidPaymentStatus(candidate.paymentStatus))
  );
}

function describePayloadProblems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ["Payload must be a JSON object."];
  }

  const candidate = payload as Partial<OrderApiCreatePayload>;
  const problems: string[] = [];

  if (typeof candidate.businessSlug !== "string" || candidate.businessSlug.trim().length === 0) {
    problems.push("businessSlug is required.");
  }

  if (typeof candidate.customerName !== "string" || candidate.customerName.trim().length === 0) {
    problems.push("customerName is required.");
  }

  if (
    typeof candidate.customerWhatsApp !== "string" ||
    candidate.customerWhatsApp.trim().length === 0
  ) {
    problems.push("customerWhatsApp is required.");
  }

  if (typeof candidate.paymentMethod !== "string" || candidate.paymentMethod.trim().length === 0) {
    problems.push("paymentMethod is required.");
  }

  if (!isValidDeliveryType(candidate.deliveryType)) {
    problems.push("deliveryType must be 'domicilio' or 'recogida en tienda'.");
  }

  if (!isValidOrderProducts(candidate.products)) {
    problems.push("products must contain at least one valid product.");
  }

  if (
    typeof candidate.total !== "number" ||
    !Number.isFinite(candidate.total) ||
    candidate.total <= 0
  ) {
    problems.push("total must be a number greater than 0.");
  }

  if (candidate.status !== undefined && !isValidOrderStatus(candidate.status)) {
    problems.push("status is invalid for public.orders.");
  }

  if (
    candidate.paymentStatus !== undefined &&
    !isValidPaymentStatus(candidate.paymentStatus)
  ) {
    problems.push("payment_status is invalid for public.orders.");
  }

  return problems;
}

export async function getBusinessDatabaseRecordBySlug(slug: string) {
  const supabase = createServerSupabaseClient();
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
  const supabase = createServerSupabaseClient();
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

export async function getOrdersByBusinessSlugFromDatabase(
  businessSlug: string,
): Promise<Order[]> {
  const business = await getBusinessDatabaseRecordBySlug(businessSlug);

  if (!business) {
    throw new Error(`Business not found for slug "${businessSlug}".`);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase orders query failed: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapSupabaseRowToOrder(row as Record<string, unknown>, {
      businessSlug,
    }),
  );
}

export async function createOrderInDatabase(payload: unknown): Promise<Order> {
  if (!validateCreateOrderPayload(payload)) {
    throw new Error(`Invalid order payload. ${describePayloadProblems(payload).join(" ")}`);
  }

  const business = await getBusinessDatabaseRecordBySlug(payload.businessSlug);

  if (!business) {
    throw new Error(`Business not found for slug "${payload.businessSlug}".`);
  }

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const orderCode = await generateUniqueOrderCode();
  const initialState = getInitialOrderState(payload.paymentMethod);
  const history =
    payload.history && payload.history.length > 0
      ? payload.history
      : createInitialOrderHistory(orderId, payload.businessSlug, now);

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
    total: payload.total,
    status: payload.status ?? initialState.status,
    created_at: now,
    updated_at: now,
    products: payload.products,
    payment_status: payload.paymentStatus ?? initialState.paymentStatus,
    date_label: payload.dateLabel ?? null,
    is_reviewed: payload.isReviewed ?? false,
    history,
    inserted_at: now,
  };

  console.info("[orders-api] insert payload", {
    authMode: getSupabaseServerAuthMode(),
    businessSlug: payload.businessSlug,
    businessId: business.id,
    orderCode,
    insertPayload,
  });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    console.error("[orders-api] Supabase insert error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      authMode: getSupabaseServerAuthMode(),
      businessSlug: payload.businessSlug,
      businessId: business.id,
      likelyCause: getSupabaseServerAuthMode().isUsingServiceRole
        ? "Schema mismatch, constraint failure, or DB-side validation."
        : "RLS or missing insert policy while using anon key on server.",
    });
    throw new Error(`Supabase orders insert failed: ${error.message}`);
  }

  return mapSupabaseRowToOrder(data as Record<string, unknown>, {
    businessSlug: payload.businessSlug,
  });
}

function validateUpdateOrderPayload(payload: unknown): payload is OrderApiUpdatePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<OrderApiUpdatePayload>;

  return (
    (candidate.status === undefined || isValidOrderStatus(candidate.status)) &&
    (candidate.paymentStatus === undefined || isValidPaymentStatus(candidate.paymentStatus)) &&
    (candidate.customerName === undefined || typeof candidate.customerName === "string") &&
    (candidate.customerWhatsApp === undefined ||
      typeof candidate.customerWhatsApp === "string") &&
    (candidate.deliveryAddress === undefined ||
      candidate.deliveryAddress === null ||
      typeof candidate.deliveryAddress === "string") &&
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
        "deliveryAddress",
        "notes",
        "total",
        "isReviewed",
        "history",
      ].includes(key),
    )
  );
}

function describeUpdatePayloadProblems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ["Payload must be a JSON object."];
  }

  const candidate = payload as Partial<OrderApiUpdatePayload>;
  const problems: string[] = [];
  const allowedKeys = [
    "status",
    "paymentStatus",
    "customerName",
    "customerWhatsApp",
    "deliveryAddress",
    "notes",
    "total",
    "isReviewed",
    "history",
  ];
  const receivedKeys = Object.keys(candidate);

  if (receivedKeys.length === 0) {
    problems.push("At least one mutable field is required.");
  }

  if (receivedKeys.some((key) => !allowedKeys.includes(key))) {
    problems.push("Payload contains unsupported fields.");
  }

  if (candidate.status !== undefined && !isValidOrderStatus(candidate.status)) {
    problems.push("status is invalid for public.orders.");
  }

  if (candidate.paymentStatus !== undefined && !isValidPaymentStatus(candidate.paymentStatus)) {
    problems.push("payment_status is invalid for public.orders.");
  }

  if (candidate.customerName !== undefined && candidate.customerName.trim().length === 0) {
    problems.push("customerName is required when provided.");
  }

  if (
    candidate.customerWhatsApp !== undefined &&
    candidate.customerWhatsApp.trim().length === 0
  ) {
    problems.push("customerWhatsApp is required when provided.");
  }

  if (
    candidate.deliveryAddress !== undefined &&
    candidate.deliveryAddress !== null &&
    candidate.deliveryAddress.trim().length === 0
  ) {
    problems.push("deliveryAddress cannot be empty when provided.");
  }

  if (
    candidate.notes !== undefined &&
    candidate.notes !== null &&
    typeof candidate.notes === "string" &&
    candidate.notes.trim().length === 0
  ) {
    problems.push("notes cannot be empty when provided as text.");
  }

  if (
    candidate.total !== undefined &&
    (!Number.isFinite(candidate.total) || candidate.total < 0)
  ) {
    problems.push("total must be a number greater than or equal to 0.");
  }

  if (candidate.isReviewed !== undefined && typeof candidate.isReviewed !== "boolean") {
    problems.push("isReviewed must be boolean.");
  }

  if (candidate.history !== undefined && !Array.isArray(candidate.history)) {
    problems.push("history must be an array.");
  }

  return problems;
}

export async function updateOrderInDatabase(
  orderId: string,
  payload: unknown,
): Promise<Order> {
  if (!validateUpdateOrderPayload(payload)) {
    throw new Error(
      `Invalid order update payload. ${describeUpdatePayloadProblems(payload).join(" ")}`,
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: existingOrder, error: lookupError } = await supabase
    .from("orders")
    .select(
      "id, business_id, customer_name, customer_whatsapp, delivery_type, delivery_address, total, notes",
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
    payload.customerName !== undefined
      ? payload.customerName.trim()
      : existingOrder.customer_name;
  const nextCustomerWhatsApp =
    payload.customerWhatsApp !== undefined
      ? payload.customerWhatsApp.trim()
      : existingOrder.customer_whatsapp ?? "";
  const nextDeliveryAddress =
    payload.deliveryAddress !== undefined
      ? payload.deliveryAddress?.trim() || ""
      : existingOrder.delivery_address ?? "";
  const nextTotal = payload.total !== undefined ? payload.total : existingOrder.total;

  if (nextCustomerName.length === 0) {
    throw new Error("Invalid order update payload. customerName is required.");
  }

  if (nextCustomerWhatsApp.length === 0) {
    throw new Error("Invalid order update payload. customerWhatsApp is required.");
  }

  if (existingOrder.delivery_type === "domicilio" && nextDeliveryAddress.length === 0) {
    throw new Error(
      "Invalid order update payload. deliveryAddress is required for domicilio orders.",
    );
  }

  if (nextTotal < 0) {
    throw new Error("Invalid order update payload. total must be greater than or equal to 0.");
  }

  const updatePayload = {
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.paymentStatus !== undefined
      ? { payment_status: payload.paymentStatus }
      : {}),
    ...(payload.customerName !== undefined
      ? { customer_name: nextCustomerName }
      : {}),
    ...(payload.customerWhatsApp !== undefined
      ? { customer_whatsapp: nextCustomerWhatsApp }
      : {}),
    ...(payload.deliveryAddress !== undefined
      ? { delivery_address: nextDeliveryAddress || null }
      : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes?.trim() || null } : {}),
    ...(payload.total !== undefined ? { total: nextTotal } : {}),
    ...(payload.isReviewed !== undefined ? { is_reviewed: payload.isReviewed } : {}),
    ...(payload.history !== undefined ? { history: payload.history } : {}),
    updated_at: new Date().toISOString(),
  };

  console.info("[orders-api] patch payload", {
    orderId,
    updatePayload,
  });

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    console.error("[orders-api] Supabase patch error", {
      orderId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      authMode: getSupabaseServerAuthMode(),
    });
    throw new Error(`Supabase orders update failed: ${error.message}`);
  }

  const businessSlug = await getBusinessSlugByDatabaseId(existingOrder.business_id);

  return mapSupabaseRowToOrder(data as Record<string, unknown>, {
    businessSlug: businessSlug ?? undefined,
  });
}
