export type BusinessReadinessStatus = "no_products" | "inactive_catalog" | "ready";

export type BusinessReadinessChecklistStatus = "completed" | "pending" | "blocked";

export type BusinessReadinessPrimaryAction =
  | "create_product"
  | "activate_products"
  | "share_public_link";

export interface BusinessReadinessChecklistItem {
  key:
    | "business_created"
    | "catalog_has_products"
    | "catalog_has_active_product"
    | "public_link_ready"
    | "business_ready";
  label: string;
  description: string;
  status: BusinessReadinessChecklistStatus;
}

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
  completedSteps: number;
  totalSteps: number;
  progressLabel: string;
  primaryAction: BusinessReadinessPrimaryAction;
  checklist: BusinessReadinessChecklistItem[];
}

function getChecklistStatus(isDone: boolean, isBlocked = false): BusinessReadinessChecklistStatus {
  if (isDone) {
    return "completed";
  }

  return isBlocked ? "blocked" : "pending";
}

export function getBusinessReadinessSnapshot(
  totalProducts: number,
  activeProducts: number,
): BusinessReadinessSnapshot {
  const safeTotalProducts = Math.max(totalProducts, 0);
  const safeActiveProducts = Math.max(Math.min(activeProducts, safeTotalProducts), 0);
  const inactiveProducts = Math.max(safeTotalProducts - safeActiveProducts, 0);
  const hasProducts = safeTotalProducts > 0;
  const hasActiveProducts = safeActiveProducts > 0;
  const canSell = hasProducts && hasActiveProducts;

  const checklist: BusinessReadinessChecklistItem[] = [
    {
      key: "business_created",
      label: "Negocio creado",
      description: "La base del negocio ya existe y el dashboard esta operativo.",
      status: getChecklistStatus(true),
    },
    {
      key: "catalog_has_products",
      label: "Catalogo con al menos un producto",
      description: hasProducts
        ? `Ya tienes ${safeTotalProducts} producto${safeTotalProducts === 1 ? "" : "s"} cargado${safeTotalProducts === 1 ? "" : "s"}.`
        : "Todavia necesitas crear el primer producto del negocio.",
      status: getChecklistStatus(hasProducts),
    },
    {
      key: "catalog_has_active_product",
      label: "Catalogo con al menos un producto activo",
      description: hasActiveProducts
        ? `Hay ${safeActiveProducts} producto${safeActiveProducts === 1 ? "" : "s"} activo${safeActiveProducts === 1 ? "" : "s"} para venta.`
        : hasProducts
          ? "Todavia no hay productos activos para recibir pedidos."
          : "Este paso queda bloqueado hasta crear el primer producto.",
      status: getChecklistStatus(hasActiveProducts, !hasProducts),
    },
    {
      key: "public_link_ready",
      label: "Link publico listo para compartir",
      description: canSell
        ? "El formulario publico ya puede compartirse sin depender de pasos manuales."
        : "El link existe, pero conviene compartirlo solo cuando haya al menos un producto activo.",
      status: getChecklistStatus(canSell, !hasActiveProducts),
    },
    {
      key: "business_ready",
      label: "Negocio listo para recibir pedidos",
      description: canSell
        ? "El negocio ya puede captar pedidos reales desde el formulario publico."
        : "Todavia falta destrabar el catalogo para cerrar la activacion inicial.",
      status: getChecklistStatus(canSell, !hasActiveProducts),
    },
  ];

  const completedSteps = checklist.filter((item) => item.status === "completed").length;
  const primaryAction = !hasProducts
    ? "create_product"
    : !hasActiveProducts
      ? "activate_products"
      : "share_public_link";

  if (!hasProducts) {
    return {
      status: "no_products",
      totalProducts: safeTotalProducts,
      activeProducts: safeActiveProducts,
      inactiveProducts,
      businessExists: true,
      canSell,
      statusLabel: "Faltan productos",
      headline: "Carga el primer producto para activar este negocio",
      reason: "El negocio ya existe, pero todavia no tiene un catalogo minimo para vender.",
      nextStep: "Crea al menos un producto y dejalo activo para habilitar el formulario publico.",
      completedSteps,
      totalSteps: checklist.length,
      progressLabel: `${completedSteps} de ${checklist.length} pasos completos`,
      primaryAction,
      checklist,
    };
  }

  if (!hasActiveProducts) {
    return {
      status: "inactive_catalog",
      totalProducts: safeTotalProducts,
      activeProducts: safeActiveProducts,
      inactiveProducts,
      businessExists: true,
      canSell,
      statusLabel: "Activa al menos un producto",
      headline: "El catalogo existe, pero todavia no esta listo para vender",
      reason: "Ya hay productos cargados, pero ninguno aparece en el formulario publico.",
      nextStep: "Activa al menos un producto para que el negocio pueda recibir pedidos.",
      completedSteps,
      totalSteps: checklist.length,
      progressLabel: `${completedSteps} de ${checklist.length} pasos completos`,
      primaryAction,
      checklist,
    };
  }

  return {
    status: "ready",
    totalProducts: safeTotalProducts,
    activeProducts: safeActiveProducts,
    inactiveProducts,
    businessExists: true,
    canSell,
    statusLabel: "Listo para recibir pedidos",
    headline: "El negocio ya quedo listo para vender",
    reason: "Ya tienes catalogo activo y el formulario publico puede recibir pedidos reales.",
    nextStep: "Comparte el link publico o abre el formulario para buscar el primer pedido real.",
    completedSteps,
    totalSteps: checklist.length,
    progressLabel: `${completedSteps} de ${checklist.length} pasos completos`,
    primaryAction,
    checklist,
  };
}

export function getProductCatalogTransitionFeedback({
  previous,
  next,
  productName,
  change,
}: {
  previous: BusinessReadinessSnapshot;
  next: BusinessReadinessSnapshot;
  productName: string;
  change: "created" | "activated" | "deactivated";
}) {
  if (change === "created") {
    if (!previous.canSell && next.canSell) {
      return `"${productName}" fue creado y el negocio ya quedo listo para vender.`;
    }

    if (!next.canSell) {
      return `"${productName}" fue creado. El siguiente paso es activar al menos un producto para vender.`;
    }

    return `"${productName}" fue creado. Ya puedes compartir el link publico del negocio.`;
  }

  if (change === "activated") {
    if (!previous.canSell && next.canSell) {
      return `"${productName}" ya esta activo. El negocio paso a listo para vender.`;
    }

    return `"${productName}" ya esta activo. Ahora tienes ${next.activeProducts} producto${next.activeProducts === 1 ? "" : "s"} activo${next.activeProducts === 1 ? "" : "s"}.`;
  }

  if (previous.canSell && !next.canSell) {
    return `"${productName}" fue desactivado. El negocio dejo de estar listo para vender.`;
  }

  return next.canSell
    ? `"${productName}" fue desactivado. Aun quedan ${next.activeProducts} producto${next.activeProducts === 1 ? "" : "s"} activo${next.activeProducts === 1 ? "" : "s"}.`
    : `"${productName}" fue desactivado. Activa al menos un producto para volver a vender.`;
}
