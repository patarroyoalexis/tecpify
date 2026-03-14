import type {
  MetricCard,
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
  dateLabel: string;
}): OrderHistoryEvent[] {
  const history: OrderHistoryEvent[] = [
    createHistoryEvent(
      `${order.id}-created`,
      "Pedido creado",
      `El pedido fue registrado con estado ${order.status} y pago ${order.paymentStatus}.`,
      order.dateLabel.includes("Hoy")
        ? "2026-03-14T08:00:00.000Z"
        : "2026-03-13T08:00:00.000Z",
    ),
  ];

  if (order.isReviewed) {
    history.unshift(
      createHistoryEvent(
        `${order.id}-reviewed`,
        "Pedido revisado",
        "El negocio revisó manualmente la solicitud y la dejó visible para operación.",
        order.dateLabel.includes("Hoy")
          ? "2026-03-14T09:00:00.000Z"
          : "2026-03-13T09:00:00.000Z",
      ),
    );
  }

  return history;
}

export const mockOrders: Order[] = [
  {
    id: "TEC-1001",
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
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1001",
      status: "pago por verificar",
      isReviewed: false,
      paymentStatus: "pendiente",
      dateLabel: "Hoy, 8:15 a. m.",
    }),
    observations: "Enviar soporte contable por WhatsApp.",
  },
  {
    id: "TEC-1002",
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
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1002",
      status: "confirmado",
      isReviewed: true,
      paymentStatus: "verificado",
      dateLabel: "Hoy, 9:40 a. m.",
    }),
  },
  {
    id: "TEC-1003",
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
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1003",
      status: "en preparación",
      isReviewed: true,
      paymentStatus: "verificado",
      dateLabel: "Hoy, 10:05 a. m.",
    }),
    observations: "Separar una factura simplificada.",
  },
  {
    id: "TEC-1004",
    client: "Café Aura",
    products: [{ name: "Vasos biodegradables 12 oz", quantity: 6 }],
    total: 57600,
    paymentMethod: "Tarjeta",
    paymentStatus: "verificado",
    deliveryType: "recogida en tienda",
    status: "listo",
    dateLabel: "Hoy, 11:30 a. m.",
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1004",
      status: "listo",
      isReviewed: false,
      paymentStatus: "verificado",
      dateLabel: "Hoy, 11:30 a. m.",
    }),
  },
  {
    id: "TEC-1005",
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
    isReviewed: false,
    history: buildOrderHistory({
      id: "TEC-1005",
      status: "pendiente de pago",
      isReviewed: false,
      paymentStatus: "no verificado",
      dateLabel: "Hoy, 12:10 p. m.",
    }),
  },
  {
    id: "TEC-1006",
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
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1006",
      status: "entregado",
      isReviewed: true,
      paymentStatus: "verificado",
      dateLabel: "Ayer, 4:45 p. m.",
    }),
  },
  {
    id: "TEC-1007",
    client: "Deli Express",
    products: [{ name: "Caja lunch mediana", quantity: 50 }],
    total: 110000,
    paymentMethod: "Nequi",
    paymentStatus: "con novedad",
    deliveryType: "domicilio",
    status: "cancelado",
    dateLabel: "Ayer, 2:20 p. m.",
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1007",
      status: "cancelado",
      isReviewed: true,
      paymentStatus: "con novedad",
      dateLabel: "Ayer, 2:20 p. m.",
    }),
    observations: "Cliente reportó cambio de proveedor.",
  },
  {
    id: "TEC-1008",
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
    isReviewed: true,
    history: buildOrderHistory({
      id: "TEC-1008",
      status: "confirmado",
      isReviewed: true,
      paymentStatus: "verificado",
      dateLabel: "Ayer, 9:10 a. m.",
    }),
  },
];

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

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
