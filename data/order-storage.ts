import type { Order } from "@/types/orders";

export function getBusinessOrdersStorageKey(businessId: string) {
  return `tecpify-orders-${businessId}`;
}

export function getBusinessDashboardStateKey(businessId: string) {
  return `tecpify-dashboard-state-${businessId}`;
}

export function readOrdersForBusiness(businessId: string): Order[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getBusinessOrdersStorageKey(businessId));
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as Order[];
  } catch {
    return null;
  }
}

export function writeOrdersForBusiness(businessId: string, orders: Order[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getBusinessOrdersStorageKey(businessId),
    JSON.stringify(orders),
  );
}
