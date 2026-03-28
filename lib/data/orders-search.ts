"use client";

import type { Order } from "@/types/orders";

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function mergeOrdersForGlobalSearch(localOrders: Order[], remoteOrders: Order[]) {
  const merged = new Map<string, Order>();

  // Remote orders are the source of truth and the current in-memory state only fills the
  // most recent UI changes until the next server refresh completes.
  for (const order of localOrders) {
    merged.set(order.orderId, order);
  }

  for (const order of remoteOrders) {
    merged.set(order.orderId, order);
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
    order.orderCode ?? "",
    order.orderId,
    order.address ?? "",
    order.observations ?? "",
    order.paymentMethod,
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
}
