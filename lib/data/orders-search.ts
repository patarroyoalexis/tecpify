"use client";

import { supabase } from "@/lib/supabase/client";
import type { Order, OrderHistoryEvent, OrderProduct, PaymentMethod, PaymentStatus } from "@/types/orders";

type SupabaseOrderRow = Record<string, unknown>;

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

function mapSupabaseRowToOrder(row: SupabaseOrderRow): Order {
  const createdAt = readString(row, "created_at", "createdAt");

  return {
    id: readString(row, "id"),
    businessId: readString(row, "business_id", "businessId"),
    client: readString(row, "client", "customer_name"),
    customerPhone: readString(row, "customer_phone", "customerPhone") || undefined,
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
    deliveryType: readString(row, "delivery_type", "deliveryType") as Order["deliveryType"],
    address: readString(row, "address") || undefined,
    status: readString(row, "status") as Order["status"],
    dateLabel: buildDateLabel(createdAt, readString(row, "date_label", "dateLabel")),
    createdAt,
    isReviewed: readBoolean(row, "is_reviewed", "isReviewed"),
    history: mapHistory(row.history),
    observations: readString(row, "observations") || undefined,
  };
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export async function getOrdersByBusinessFromSupabase(businessDatabaseId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", businessDatabaseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase orders query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapSupabaseRowToOrder(row as SupabaseOrderRow));
}

export function mergeOrdersForGlobalSearch(localOrders: Order[], remoteOrders: Order[]) {
  const merged = new Map<string, Order>();

  for (const order of remoteOrders) {
    merged.set(order.id, order);
  }

  for (const order of localOrders) {
    merged.set(order.id, order);
  }

  return [...merged.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function matchesGlobalOrderSearch(order: Order, query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableValues = [
    order.client,
    order.customerPhone ?? "",
    order.id,
    order.address ?? "",
    order.observations ?? "",
    order.paymentMethod,
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
}
