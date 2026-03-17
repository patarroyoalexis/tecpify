"use client";

import type { Order } from "@/types/orders";

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function mergeOrdersForGlobalSearch(localOrders: Order[], remoteOrders: Order[]) {
  const merged = new Map<string, Order>();

  // Transitional rule: remote orders are the source of truth and local storage only fills gaps.
  for (const order of localOrders) {
    merged.set(order.id, order);
  }

  for (const order of remoteOrders) {
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
