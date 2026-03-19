export type BusinessReadinessStatus = "no_products" | "inactive_catalog" | "ready";

export interface BusinessReadinessSnapshot {
  status: BusinessReadinessStatus;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  businessExists: boolean;
  canSell: boolean;
  statusLabel: string;
  headline: string;
  reason: string;
  nextStep: string;
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
      inactiveProducts: 0,
      businessExists: true,
      canSell: false,
      statusLabel: "Faltan productos",
      headline: "Agrega tu primer producto para empezar a vender",
      reason: "El negocio ya fue creado, pero todavia no tiene catalogo cargado.",
      nextStep: "Crea al menos un producto y dejalo activo para habilitar el link publico.",
    };
  }

  if (activeProducts <= 0) {
    return {
      status: "inactive_catalog",
      totalProducts,
      activeProducts: 0,
      inactiveProducts: totalProducts,
      businessExists: true,
      canSell: false,
      statusLabel: "Activa al menos un producto",
      headline: "Tu catalogo existe, pero aun no puede recibir pedidos",
      reason: "Hay productos cargados, pero ninguno esta activo en el catalogo publico.",
      nextStep: "Activa al menos un producto para que el negocio pueda recibir pedidos.",
    };
  }

  return {
    status: "ready",
    totalProducts,
    activeProducts,
    inactiveProducts: Math.max(totalProducts - activeProducts, 0),
    businessExists: true,
    canSell: true,
    statusLabel: "Listo para recibir pedidos",
    headline: "Tu negocio ya esta listo para vender",
    reason: "Ya tienes al menos un producto activo y el formulario publico puede usarse.",
    nextStep: "Comparte tu link publico para buscar el primer pedido real.",
  };
}
