import type {
  MetricCard,
  MetricTone,
  OperationalPriority,
  Order,
  OrderHistoryEvent,
  OrderStatus,
} from "@/types/orders";

function createHistoryEvent(
  id: string,
  title: string,
  description: string,
  occurredAt: string,
): OrderHistoryEvent {
  return {
    id,
    title,
    description,
    occurredAt,
  };
}

function buildOrderHistory(order: {
  id: string;
  status: OrderStatus;
  isReviewed: boolean;
  paymentStatus: Order["paymentStatus"];
  createdAt: string;
}): OrderHistoryEvent[] {
  const history: OrderHistoryEvent[] = [
    createHistoryEvent(
      `${order.id}-created`,
      "Pedido creado",
      `El pedido fue registrado con estado ${order.status} y pago ${order.paymentStatus}.`,
      order.createdAt,
    ),
  ];

  if (order.isReviewed) {
    history.unshift(
      createHistoryEvent(
        `${order.id}-reviewed`,
        "Pedido revisado",
        "El negocio revisó manualmente la solicitud y la dejó visible para operación.",
        new Date(new Date(order.createdAt).getTime() + 60 * 60 * 1000).toISOString(),
      ),
    );
  }

  return history;
}

export const mockOrders: Order[] = [
  {
    id: "TEC-1001",
    businessSlug: "panaderia-estacion",
    client: "Panadería La Estación",
    products: [
      { name: "Caja de brownies", quantity: 2 },
      { name: "Café molido 500 g", quantity: 1 },
    ],
    total: 68500,
    paymentMethod: "Transferencia",
    paymentStatus: "pendiente",
    deliveryType: "domicilio",
    status: "pago por verificar",
    dateLabel: "Hoy, 8:15 a. m.",
    createdAt: "2026-03-14T08:15:00.000Z",
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1001",
      status: "pago por verificar",
      isReviewed: false,
      paymentStatus: "pendiente",
      createdAt: "2026-03-14T08:15:00.000Z",
    }),
    observations: "Enviar soporte contable por WhatsApp.",
  },
  {
    id: "TEC-1002",
    businessSlug: "cafe-aura",
    client: "Boutique María Elena",
    products: [
      { name: "Bolsa kraft personalizada", quantity: 30 },
      { name: "Tarjetas de agradecimiento", quantity: 30 },
    ],
    total: 124000,
    paymentMethod: "Nequi",
    paymentStatus: "verificado",
    deliveryType: "recogida en tienda",
    status: "confirmado",
    dateLabel: "Hoy, 9:40 a. m.",
    createdAt: "2026-03-14T09:40:00.000Z",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1002",
      status: "confirmado",
      isReviewed: true,
      paymentStatus: "verificado",
      createdAt: "2026-03-14T09:40:00.000Z",
    }),
  },
  {
    id: "TEC-1003",
    businessSlug: "panaderia-estacion",
    client: "Tienda Don Julio",
    products: [
      { name: "Pack de etiquetas premium", quantity: 4 },
      { name: "Rollos térmicos", quantity: 2 },
    ],
    total: 89200,
    paymentMethod: "Efectivo",
    paymentStatus: "verificado",
    deliveryType: "domicilio",
    status: "en preparación",
    dateLabel: "Hoy, 10:05 a. m.",
    createdAt: "2026-03-14T10:05:00.000Z",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1003",
      status: "en preparación",
      isReviewed: true,
      paymentStatus: "verificado",
      createdAt: "2026-03-14T10:05:00.000Z",
    }),
    observations: "Separar una factura simplificada.",
  },
  {
    id: "TEC-1004",
    businessSlug: "cafe-aura",
    client: "Café Aura",
    products: [{ name: "Vasos biodegradables 12 oz", quantity: 6 }],
    total: 57600,
    paymentMethod: "Tarjeta",
    paymentStatus: "verificado",
    deliveryType: "recogida en tienda",
    status: "listo",
    dateLabel: "Hoy, 11:30 a. m.",
    createdAt: "2026-03-14T11:30:00.000Z",
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1004",
      status: "listo",
      isReviewed: false,
      paymentStatus: "verificado",
      createdAt: "2026-03-14T11:30:00.000Z",
    }),
  },
  {
    id: "TEC-1005",
    businessSlug: "panaderia-estacion",
    client: "Florería Primavera",
    products: [
      { name: "Listón decorativo", quantity: 8 },
      { name: "Papel coreano", quantity: 5 },
    ],
    total: 74300,
    paymentMethod: "Transferencia",
    paymentStatus: "no verificado",
    deliveryType: "domicilio",
    status: "pendiente de pago",
    dateLabel: "Hoy, 12:10 p. m.",
    createdAt: "2026-03-14T12:10:00.000Z",
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1005",
      status: "pendiente de pago",
      isReviewed: false,
      paymentStatus: "no verificado",
      createdAt: "2026-03-14T12:10:00.000Z",
    }),
  },
  {
    id: "TEC-1006",
    businessSlug: "panaderia-estacion",
    client: "Pet Shop Huellitas",
    products: [
      { name: "Stickers promocionales", quantity: 120 },
      { name: "Tarjeta de fidelidad", quantity: 60 },
    ],
    total: 96500,
    paymentMethod: "Contra entrega",
    paymentStatus: "verificado",
    deliveryType: "domicilio",
    status: "entregado",
    dateLabel: "Ayer, 4:45 p. m.",
    createdAt: "2026-03-13T16:45:00.000Z",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1006",
      status: "entregado",
      isReviewed: true,
      paymentStatus: "verificado",
      createdAt: "2026-03-13T16:45:00.000Z",
    }),
  },
  {
    id: "TEC-1007",
    businessSlug: "cafe-aura",
    client: "Deli Express",
    products: [{ name: "Caja lunch mediana", quantity: 50 }],
    total: 110000,
    paymentMethod: "Nequi",
    paymentStatus: "con novedad",
    deliveryType: "domicilio",
    status: "cancelado",
    dateLabel: "Ayer, 2:20 p. m.",
    createdAt: "2026-03-13T14:20:00.000Z",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1007",
      status: "cancelado",
      isReviewed: true,
      paymentStatus: "con novedad",
      createdAt: "2026-03-13T14:20:00.000Z",
    }),
    observations: "Cliente reportó cambio de proveedor.",
  },
  {
    id: "TEC-1008",
    businessSlug: "cafe-aura",
    client: "Mercado San Pedro",
    products: [
      { name: "Etiquetas de precio", quantity: 10 },
      { name: "Marcadores punta fina", quantity: 3 },
    ],
    total: 53300,
    paymentMethod: "Efectivo",
    paymentStatus: "verificado",
    deliveryType: "recogida en tienda",
    status: "confirmado",
    dateLabel: "Ayer, 9:10 a. m.",
    createdAt: "2026-03-13T09:10:00.000Z",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1008",
      status: "confirmado",
      isReviewed: true,
      paymentStatus: "verificado",
      createdAt: "2026-03-13T09:10:00.000Z",
    }),
  },
];

export function getMockOrdersByBusinessSlug(businessSlug: string) {
  return mockOrders.filter((order) => order.businessSlug === businessSlug);
}

function getReferenceDate(orders: Order[]) {
  const latestTimestamp = orders.reduce((highestValue, order) => {
    const currentTimestamp = new Date(order.createdAt).getTime();
    return Number.isFinite(currentTimestamp)
      ? Math.max(highestValue, currentTimestamp)
      : highestValue;
  }, 0);

  return latestTimestamp > 0 ? new Date(latestTimestamp) : new Date();
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function getStartOfUtcWeek(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

function getStartOfUtcMonth(date: Date) {
  const monthStart = new Date(date);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart;
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

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export function getElapsedMinutes(order: Order): number {
  const createdAt = new Date(order.createdAt).getTime();
  const now = new Date("2026-03-14T13:00:00.000Z").getTime();
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

const actionableStatuses: OrderStatus[] = ["pendiente de pago", "pago por verificar"];
const productionStatuses: OrderStatus[] = ["confirmado", "en preparación", "listo"];

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
}

export function getOrdersForReferenceDay(orders: Order[]) {
  const referenceDate = getReferenceDate(orders);

  return orders.filter((order) =>
    isSameCalendarDay(new Date(order.createdAt), referenceDate),
  );
}

export function getOrdersRegisteredThisWeek(orders: Order[]) {
  const referenceDate = getReferenceDate(orders);
  const weekStart = getStartOfUtcWeek(referenceDate).getTime();
  const weekEnd = new Date(referenceDate).getTime();

  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= weekStart && createdAt <= weekEnd;
  });
}

export function getOrdersRegisteredThisMonth(orders: Order[]) {
  const referenceDate = getReferenceDate(orders);
  const monthStart = getStartOfUtcMonth(referenceDate).getTime();
  const monthEnd = new Date(referenceDate).getTime();

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

  for (const order of orders.filter(isActiveOrder)) {
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
  const activeOrders = orders.filter(isActiveOrder);

  if (activeOrders.length === 0) {
    return 0;
  }

  return (
    activeOrders.reduce((total, order) => total + order.total, 0) / activeOrders.length
  );
}

export function getDashboardSummary(orders: Order[]) {
  const todayOrders = getOrdersForReferenceDay(orders);
  const recentOrders = [...orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 4);
  const todayTopProducts = getTopProducts(todayOrders, 1);
  const overallTopProducts = getTopProducts(orders, 1);

  return {
    todayOrdersCount: todayOrders.length,
    todayRevenue: todayOrders
      .filter(isActiveOrder)
      .reduce((total, order) => total + order.total, 0),
    pendingPaymentsCount: orders.filter(isPendingPayment).length,
    featuredProduct: todayTopProducts[0] ?? overallTopProducts[0] ?? null,
    recentOrders,
  };
}

export function getBusinessInsights(orders: Order[]) {
  const insights: string[] = [];
  const todayOrders = getOrdersForReferenceDay(orders);
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
      `El producto ${summary.featuredProduct.name} fue el mas pedido del dia con ${summary.featuredProduct.quantity} unidades.`,
    );
  }

  if (summary.pendingPaymentsCount > 0) {
    insights.push(
      `Tienes ${summary.pendingPaymentsCount} pago${summary.pendingPaymentsCount > 1 ? "s" : ""} pendiente${summary.pendingPaymentsCount > 1 ? "s" : ""} por validar para no frenar la operacion.`,
    );
  }

  if (insights.length === 0 && todayOrders.length > 0) {
    insights.push(
      `Hoy llevas ${todayOrders.length} pedido${todayOrders.length > 1 ? "s" : ""} en el flujo actual.`,
    );
  }

  return insights;
}

export function getDashboardMetrics(orders: Order[]): MetricCard[] {
  const pendingActions = orders.filter((order) =>
    actionableStatuses.includes(order.status),
  ).length;

  const inProgress = orders.filter((order) =>
    productionStatuses.includes(order.status),
  ).length;

  const deliveredRevenue = orders
    .filter((order) => order.status === "entregado")
    .reduce((total, order) => total + order.total, 0);

  const cancelledCount = orders.filter((order) => order.status === "cancelado").length;

  return [
    {
      title: "Pedidos registrados",
      value: `${orders.length}`,
      description: "Vista general del flujo operativo reciente.",
      tone: "neutral",
    },
    {
      title: "Acciones pendientes",
      value: `${pendingActions}`,
      description: "Pedidos por cobrar o pagos por verificar.",
      tone: "warning",
    },
    {
      title: "En operación",
      value: `${inProgress}`,
      description: "Pedidos confirmados, en preparación o listos.",
      tone: "info",
    },
    {
      title: "Ingresos entregados",
      value: formatCurrency(deliveredRevenue),
      description:
        cancelledCount > 0
          ? `${cancelledCount} pedido${cancelledCount > 1 ? "s" : ""} cancelado${cancelledCount > 1 ? "s" : ""}.`
          : "Sin pedidos cancelados.",
      tone: "success",
    },
  ];
}

export function getOperationalMetrics(orders: Order[]): MetricCard[] {
  const pendingActions = orders.filter((order) =>
    actionableStatuses.includes(order.status),
  ).length;

  const inProgress = orders.filter((order) =>
    productionStatuses.includes(order.status),
  ).length;

  const deliveredRevenue = orders
    .filter((order) => order.status === "entregado")
    .reduce((total, order) => total + order.total, 0);

  const cancelledCount = orders.filter((order) => order.status === "cancelado").length;

  return [
    {
      title: "Pendientes",
      value: `${pendingActions}`,
      description: "Pedidos por cobrar o pagos por verificar.",
      tone: "warning",
    },
    {
      title: "En operación",
      value: `${inProgress}`,
      description: "Pedidos confirmados, en preparación o listos.",
      tone: "info",
    },
    {
      title: "Ingresos",
      value: formatCurrency(deliveredRevenue),
      description:
        cancelledCount > 0
          ? `${cancelledCount} pedido${cancelledCount > 1 ? "s" : ""} cancelado${cancelledCount > 1 ? "s" : ""}.`
          : "Sin pedidos cancelados.",
      tone: "success",
    },
  ];
}

export function getMetricsOverviewSnapshot(orders: Order[]): MetricsOverviewSnapshot {
  const todayOrders = getOrdersForReferenceDay(orders);
  const pendingActions = orders.filter((order) =>
    actionableStatuses.includes(order.status),
  ).length;
  const inProgress = orders.filter((order) =>
    productionStatuses.includes(order.status),
  ).length;
  const deliveredRevenue = orders
    .filter((order) => order.status === "entregado")
    .reduce((total, order) => total + order.total, 0);
  const cancelledCount = orders.filter((order) => order.status === "cancelado").length;
  const pendingPaymentsCount = orders.filter(isPendingPayment).length;
  const topProducts = getTopProducts(orders, 3);
  const todayRevenue = todayOrders
    .filter(isActiveOrder)
    .reduce((total, order) => total + order.total, 0);

  return {
    metrics: [
      {
        title: "Pedidos del dia",
        value: `${todayOrders.length}`,
        description: "Pedidos reales registrados en el corte mas reciente.",
        tone: "neutral",
      },
      {
        title: "Pendientes de atencion",
        value: `${pendingActions}`,
        description: "Cobros o validaciones de pago que pueden frenar la operacion.",
        tone: "warning",
      },
      {
        title: "En operacion",
        value: `${inProgress}`,
        description: "Pedidos confirmados, en preparacion o listos para entregar.",
        tone: "info",
      },
      {
        title: "Ingresos entregados",
        value: formatCurrency(deliveredRevenue),
        description: "Venta ya cerrada en pedidos entregados del historial actual.",
        tone: "success",
      },
    ],
    focusItems: [
      {
        label: "Cobros por revisar",
        value: `${pendingPaymentsCount}`,
        description:
          pendingPaymentsCount > 0
            ? "Conviene resolver estos pagos primero para destrabar pedidos."
            : "No hay pagos pendientes frenando el flujo en este momento.",
        tone: pendingPaymentsCount > 0 ? "warning" : "success",
      },
      {
        label: "Carga activa",
        value: `${inProgress}`,
        description:
          inProgress > 0
            ? "Pedidos actualmente en produccion o listos para entregar."
            : "No hay pedidos en produccion abiertos ahora mismo.",
        tone: inProgress > 0 ? "info" : "neutral",
      },
      {
        label: "Venta del dia",
        value: formatCurrency(todayRevenue),
        description:
          todayOrders.length > 0
            ? `Basado en ${todayOrders.length} pedido${todayOrders.length === 1 ? "" : "s"} del corte actual.`
            : "Aun no hay pedidos en el dia de referencia actual.",
        tone: todayRevenue > 0 ? "success" : "neutral",
      },
      {
        label: "Cancelaciones",
        value: `${cancelledCount}`,
        description:
          cancelledCount > 0
            ? "Sirve para revisar friccion comercial o fallas en cierre."
            : "No hay cancelaciones registradas en el historial actual.",
        tone: cancelledCount > 0 ? "warning" : "neutral",
      },
    ],
    topProducts,
  };
}
