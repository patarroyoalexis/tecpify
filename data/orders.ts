import type {
  MetricCard,
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
    businessId: "panaderia-estacion",
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
    businessId: "cafe-aura",
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
    businessId: "panaderia-estacion",
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
    businessId: "cafe-aura",
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
    businessId: "panaderia-estacion",
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
    businessId: "panaderia-estacion",
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
    businessId: "cafe-aura",
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
    businessId: "cafe-aura",
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

export function getMockOrdersByBusinessId(businessId: string) {
  return mockOrders.filter((order) => order.businessId === businessId);
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
