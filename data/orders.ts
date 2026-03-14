import type { MetricCard, Order, OrderStatus } from "@/types/orders";

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
    status: "pago por verificar",
    dateLabel: "Hoy, 8:15 a. m.",
    isReviewed: false,
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
    status: "confirmado",
    dateLabel: "Hoy, 9:40 a. m.",
    isReviewed: true,
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
    status: "en preparación",
    dateLabel: "Hoy, 10:05 a. m.",
    isReviewed: true,
    observations: "Separar una factura simplificada.",
  },
  {
    id: "TEC-1004",
    client: "Café Aura",
    products: [{ name: "Vasos biodegradables 12 oz", quantity: 6 }],
    total: 57600,
    paymentMethod: "Tarjeta",
    status: "listo",
    dateLabel: "Hoy, 11:30 a. m.",
    isReviewed: false,
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
    status: "pendiente de pago",
    dateLabel: "Hoy, 12:10 p. m.",
    isReviewed: false,
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
    status: "entregado",
    dateLabel: "Ayer, 4:45 p. m.",
    isReviewed: true,
  },
  {
    id: "TEC-1007",
    client: "Deli Express",
    products: [{ name: "Caja lunch mediana", quantity: 50 }],
    total: 110000,
    paymentMethod: "Nequi",
    status: "cancelado",
    dateLabel: "Ayer, 2:20 p. m.",
    isReviewed: true,
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
    status: "confirmado",
    dateLabel: "Ayer, 9:10 a. m.",
    isReviewed: true,
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
