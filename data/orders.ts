import {
  getCurrentDate,
  getCurrentTimestamp,
  getStartOfUtcMonth,
  getStartOfUtcWeek,
  isSameUtcCalendarDay,
} from "@/lib/operational-time";
import type {
  MetricCard,
  MetricTone,
  OperationalPriority,
  Order,
} from "@/types/orders";
import { isPendingFiadoOrder } from "@/types/orders";

function getOperationalReferenceDate() {
  return getCurrentDate();
}

function isActiveOrder(order: Order) {
  return order.status !== "cancelado";
}

function isPendingPayment(order: Order) {
  return (
    isActiveOrder(order) &&
    (order.paymentStatus === "pendiente" ||
      order.paymentStatus === "con novedad" ||
      order.paymentStatus === "no verificado")
  );
}

function isEffectiveRevenueOrder(order: Order) {
  return isActiveOrder(order) && !isPendingFiadoOrder(order);
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export function getElapsedMinutes(order: Order): number {
  const createdAt = new Date(order.createdAt).getTime();
  const now = getCurrentTimestamp();
  return Math.max(0, Math.floor((now - createdAt) / (1000 * 60)));
}

export function formatElapsedTime(order: Order): string {
  const elapsedMinutes = getElapsedMinutes(order);

  if (elapsedMinutes < 60) {
    return `Hace ${elapsedMinutes} min`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Hace ${elapsedHours} h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Hace ${elapsedDays} d`;
}

export function getOperationalPriority(order: Order): OperationalPriority {
  const elapsedMinutes = getElapsedMinutes(order);

  if (
    (order.status === "pendiente de pago" || order.status === "pago por verificar") &&
    elapsedMinutes >= 45
  ) {
    return "alta";
  }

  if (
    (order.status === "confirmado" || order.status === "en preparación") &&
    elapsedMinutes >= 120
  ) {
    return "media";
  }

  return "normal";
}

export function getOperationalPriorityScore(order: Order): number {
  const priority = getOperationalPriority(order);
  const priorityWeight = priority === "alta" ? 3 : priority === "media" ? 2 : 1;

  return priorityWeight * 100000 + getElapsedMinutes(order);
}

const actionableStatuses = ["pendiente de pago", "pago por verificar"] as const;
const productionStatuses = ["confirmado", "en preparación", "listo"] as const;

function isActionableOrderStatus(status: Order["status"]) {
  return actionableStatuses.some((candidate) => candidate === status);
}

function isProductionOrderStatus(status: Order["status"]) {
  return productionStatuses.some((candidate) => candidate === status);
}

export interface ProductPerformance {
  name: string;
  quantity: number;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  ordersCount: number;
}

export interface MetricsOverviewFocusItem {
  label: string;
  value: string;
  description: string;
  tone: MetricTone;
}

export interface MetricsOverviewSnapshot {
  metrics: MetricCard[];
  focusItems: MetricsOverviewFocusItem[];
  topProducts: ProductPerformance[];
  referenceDateLabel: string;
  hasOrders: boolean;
}

export interface OrdersMetricsSummary {
  totalOrders: number;
  activeOrders: Order[];
  effectiveRevenueOrders: Order[];
  referenceDayOrders: Order[];
  recentOrders: Order[];
  pendingFiadoOrders: Order[];
  topProducts: ProductPerformance[];
  featuredProduct: ProductPerformance | null;
  deliveredRevenue: number;
  activeRevenue: number;
  referenceDayRevenue: number;
  averageTicket: number;
  pendingActionsCount: number;
  pendingPaymentsCount: number;
  inProgressCount: number;
  deliveredCount: number;
  cancelledCount: number;
  unreviewedCount: number;
  pendingFiadoCount: number;
  referenceDateLabel: string;
  hasOrders: boolean;
}

function formatReferenceDateLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function getOrdersForReferenceDay(orders: Order[]) {
  const referenceDate = getOperationalReferenceDate();

  return orders.filter((order) =>
    isSameUtcCalendarDay(new Date(order.createdAt), referenceDate),
  );
}

export function getOrdersRegisteredThisWeek(orders: Order[]) {
  const referenceDate = getOperationalReferenceDate();
  const weekStart = getStartOfUtcWeek(referenceDate).getTime();
  const weekEnd = referenceDate.getTime();

  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= weekStart && createdAt <= weekEnd;
  });
}

export function getOrdersRegisteredThisMonth(orders: Order[]) {
  const referenceDate = getOperationalReferenceDate();
  const monthStart = getStartOfUtcMonth(referenceDate).getTime();
  const monthEnd = referenceDate.getTime();

  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= monthStart && createdAt <= monthEnd;
  });
}

export function getTopProducts(orders: Order[], limit = 3): ProductPerformance[] {
  const productsMap = new Map<string, number>();

  for (const order of orders.filter(isActiveOrder)) {
    for (const product of order.products) {
      productsMap.set(product.name, (productsMap.get(product.name) ?? 0) + product.quantity);
    }
  }

  return [...productsMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, limit);
}

export function getRevenueSeries(orders: Order[], limit = 5): RevenuePoint[] {
  const revenueByDay = new Map<string, RevenuePoint>();

  for (const order of orders.filter(isEffectiveRevenueOrder)) {
    const date = new Date(order.createdAt);
    const key = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(date);
    const currentPoint = revenueByDay.get(key);

    revenueByDay.set(key, {
      label,
      revenue: (currentPoint?.revenue ?? 0) + order.total,
      ordersCount: (currentPoint?.ordersCount ?? 0) + 1,
    });
  }

  return [...revenueByDay.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .slice(-limit)
    .map(([, value]) => value);
}

export function getAverageTicket(orders: Order[]) {
  const effectiveRevenueOrders = orders.filter(isEffectiveRevenueOrder);

  if (effectiveRevenueOrders.length === 0) {
    return 0;
  }

  return (
    effectiveRevenueOrders.reduce((total, order) => total + order.total, 0) /
    effectiveRevenueOrders.length
  );
}

export function getOrdersMetricsSummary(orders: Order[]): OrdersMetricsSummary {
  const referenceDate = getOperationalReferenceDate();
  const referenceDayOrders = getOrdersForReferenceDay(orders);
  const activeOrders = orders.filter(isActiveOrder);
  const effectiveRevenueOrders = orders.filter(isEffectiveRevenueOrder);
  const pendingFiadoOrders = orders.filter(isPendingFiadoOrder);
  const topProducts = getTopProducts(orders, 3);
  const featuredProduct = getTopProducts(referenceDayOrders, 1)[0] ?? topProducts[0] ?? null;
  const recentOrders = [...orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 4);

  return {
    totalOrders: orders.length,
    activeOrders,
    effectiveRevenueOrders,
    referenceDayOrders,
    recentOrders,
    pendingFiadoOrders,
    topProducts,
    featuredProduct,
    deliveredRevenue: orders
      .filter((order) => order.status === "entregado" && !isPendingFiadoOrder(order))
      .reduce((total, order) => total + order.total, 0),
    activeRevenue: effectiveRevenueOrders.reduce((total, order) => total + order.total, 0),
    referenceDayRevenue: referenceDayOrders
      .filter(isEffectiveRevenueOrder)
      .reduce((total, order) => total + order.total, 0),
    averageTicket: getAverageTicket(orders),
    pendingActionsCount: orders.filter((order) => isActionableOrderStatus(order.status)).length,
    pendingPaymentsCount: orders.filter(isPendingPayment).length,
    inProgressCount: orders.filter((order) => isProductionOrderStatus(order.status)).length,
    deliveredCount: orders.filter((order) => order.status === "entregado").length,
    cancelledCount: orders.filter((order) => order.status === "cancelado").length,
    unreviewedCount: orders.filter((order) => !order.isReviewed).length,
    pendingFiadoCount: pendingFiadoOrders.length,
    referenceDateLabel: formatReferenceDateLabel(referenceDate),
    hasOrders: orders.length > 0,
  };
}

export function getDashboardSummary(orders: Order[]) {
  const summary = getOrdersMetricsSummary(orders);

  return {
    todayOrdersCount: summary.referenceDayOrders.length,
    todayRevenue: summary.referenceDayRevenue,
    pendingPaymentsCount: summary.pendingPaymentsCount,
    featuredProduct: summary.featuredProduct,
    recentOrders: summary.recentOrders,
    referenceDateLabel: summary.referenceDateLabel,
  };
}

export function getBusinessInsights(orders: Order[]) {
  const insights: string[] = [];
  const metricsSummary = getOrdersMetricsSummary(orders);
  const summary = getDashboardSummary(orders);
  const revenueSeries = getRevenueSeries(orders, 8);
  const previousDays = revenueSeries.slice(0, -1);

  if (previousDays.length > 0) {
    const averageRecentRevenue =
      previousDays.reduce((total, point) => total + point.revenue, 0) / previousDays.length;

    if (averageRecentRevenue > 0 && summary.todayRevenue > averageRecentRevenue) {
      const growth = Math.round(
        ((summary.todayRevenue - averageRecentRevenue) / averageRecentRevenue) * 100,
      );
      insights.push(
        `Excelente, hoy aumentaste tus ventas un ${growth}% frente al promedio reciente.`,
      );
    }
  }

  if (summary.featuredProduct) {
    insights.push(
      `El producto ${summary.featuredProduct.name} fue el mas pedido del corte actual con ${summary.featuredProduct.quantity} unidades.`,
    );
  }

  if (summary.pendingPaymentsCount > 0) {
    insights.push(
      `Tienes ${summary.pendingPaymentsCount} pago${summary.pendingPaymentsCount > 1 ? "s" : ""} pendiente${summary.pendingPaymentsCount > 1 ? "s" : ""} por validar para no frenar la operacion.`,
    );
  }

  if (metricsSummary.pendingFiadoCount > 0) {
    insights.push(
      `Hay ${metricsSummary.pendingFiadoCount} fiado${metricsSummary.pendingFiadoCount === 1 ? "" : "s"} pendiente${metricsSummary.pendingFiadoCount === 1 ? "" : "s"} fuera de ingresos efectivos hasta marcarlos como pagados.`,
    );
  }

  if (insights.length === 0 && metricsSummary.referenceDayOrders.length > 0) {
    insights.push(
      `En el corte actual llevas ${metricsSummary.referenceDayOrders.length} pedido${metricsSummary.referenceDayOrders.length > 1 ? "s" : ""} en el flujo operativo.`,
    );
  }

  return insights;
}

export function getDashboardMetrics(orders: Order[]): MetricCard[] {
  const summary = getOrdersMetricsSummary(orders);

  return [
    {
      title: "Pedidos registrados",
      value: `${summary.totalOrders}`,
      description: "Vista general del flujo operativo reciente.",
      tone: "neutral",
    },
    {
      title: "Acciones pendientes",
      value: `${summary.pendingActionsCount}`,
      description: "Pedidos por cobrar o pagos por verificar.",
      tone: "warning",
    },
    {
      title: "En operación",
      value: `${summary.inProgressCount}`,
      description: "Pedidos confirmados, en preparación o listos.",
      tone: "info",
    },
    {
      title: "Ingresos entregados",
      value: formatCurrency(summary.deliveredRevenue),
      description:
        summary.cancelledCount > 0
          ? `${summary.cancelledCount} pedido${summary.cancelledCount > 1 ? "s" : ""} cancelado${summary.cancelledCount > 1 ? "s" : ""}.`
          : "Sin pedidos cancelados.",
      tone: "success",
    },
  ];
}

export function getOperationalMetrics(orders: Order[]): MetricCard[] {
  const summary = getOrdersMetricsSummary(orders);

  return [
    {
      title: "Pendientes",
      value: `${summary.pendingActionsCount}`,
      description: "Pedidos por cobrar o pagos por verificar.",
      tone: "warning",
    },
    {
      title: "En operación",
      value: `${summary.inProgressCount}`,
      description: "Pedidos confirmados, en preparación o listos.",
      tone: "info",
    },
    {
      title: "Ingresos",
      value: formatCurrency(summary.deliveredRevenue),
      description:
        summary.cancelledCount > 0
          ? `${summary.cancelledCount} pedido${summary.cancelledCount > 1 ? "s" : ""} cancelado${summary.cancelledCount > 1 ? "s" : ""}.`
          : "Sin pedidos cancelados.",
      tone: "success",
    },
  ];
}

export function getMetricsOverviewSnapshot(orders: Order[]): MetricsOverviewSnapshot {
  const summary = getOrdersMetricsSummary(orders);

  return {
    metrics: [
      {
        title: "Pedidos del corte",
        value: `${summary.referenceDayOrders.length}`,
        description: `Pedidos persistidos del dia operativo actual (${summary.referenceDateLabel}).`,
        tone: "neutral",
      },
      {
        title: "Pendientes de atención",
        value: `${summary.pendingActionsCount}`,
        description: "Cobros o validaciones de pago que pueden frenar la operación.",
        tone: "warning",
      },
      {
        title: "En operación",
        value: `${summary.inProgressCount}`,
        description: "Pedidos confirmados, en preparación o listos para entregar.",
        tone: "info",
      },
      {
        title: "Ingresos entregados",
        value: formatCurrency(summary.deliveredRevenue),
        description: "Venta ya cerrada en pedidos entregados del historial actual.",
        tone: "success",
      },
    ],
    focusItems: [
      {
        label: "Cobros por revisar",
        value: `${summary.pendingPaymentsCount}`,
        description:
          summary.pendingPaymentsCount > 0
            ? "Conviene resolver estos pagos primero para destrabar pedidos."
            : "No hay pagos pendientes frenando el flujo en este momento.",
        tone: summary.pendingPaymentsCount > 0 ? "warning" : "success",
      },
      {
        label: "Carga activa",
        value: `${summary.inProgressCount}`,
        description:
          summary.inProgressCount > 0
            ? "Pedidos actualmente en producción o listos para entregar."
            : "No hay pedidos en producción abiertos ahora mismo.",
        tone: summary.inProgressCount > 0 ? "info" : "neutral",
      },
      {
        label: "Venta del corte",
        value: formatCurrency(summary.referenceDayRevenue),
        description:
          summary.referenceDayOrders.length > 0
            ? `Basado en ${summary.referenceDayOrders.length} pedido${summary.referenceDayOrders.length === 1 ? "" : "s"} del dia operativo ${summary.referenceDateLabel}.`
            : "Aun no hay pedidos en el día operativo actual.",
        tone: summary.referenceDayRevenue > 0 ? "success" : "neutral",
      },
      {
        label: "Cancelaciones",
        value: `${summary.cancelledCount}`,
        description:
          summary.cancelledCount > 0
            ? "Sirve para revisar fricción comercial o fallas en cierre."
            : "No hay cancelaciones registradas en el historial actual.",
        tone: summary.cancelledCount > 0 ? "warning" : "neutral",
      },
    ],
    topProducts: summary.topProducts,
    referenceDateLabel: summary.referenceDateLabel,
    hasOrders: summary.hasOrders,
  };
}
