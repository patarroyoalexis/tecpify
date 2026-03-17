import {
  createInitialOrderHistory,
  getInitialOrderState,
  isValidDeliveryType,
  isValidOrderProducts,
  isValidOrderStatus,
  isValidPaymentStatus,
  mapSupabaseRowToOrder,
  type OrderApiCreatePayload,
} from "@/lib/orders/mappers";
import { createServerSupabaseClient, getSupabaseServerAuthMode } from "@/lib/supabase/server";
import type { Order } from "@/types/orders";

interface BusinessLookupRow {
  id: string;
  slug: string;
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
