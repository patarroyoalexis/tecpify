export type BusinessReadinessStatus = "no_products" | "inactive_catalog" | "ready";

export interface BusinessReadinessSnapshot {
  status: BusinessReadinessStatus;
  totalProducts: number;
  activeProducts: number;
}

export function getBusinessReadinessSnapshot(
  totalProducts: number,
  activeProducts: number,
): BusinessReadinessSnapshot {
  if (totalProducts <= 0) {
    return {
      status: "no_products",
      totalProducts: 0,
      activeProducts: 0,
    };
  }

  if (activeProducts <= 0) {
    return {
      status: "inactive_catalog",
      totalProducts,
      activeProducts: 0,
    };
  }

  return {
    status: "ready",
    totalProducts,
    activeProducts,
  };
}
