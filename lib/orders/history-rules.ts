import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/transitions";
import type {
  DeliveryType,
  Order,
  OrderHistoryEvent,
  OrderProduct,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";

export const ORDER_ORIGINS = ["public_form", "workspace_manual"] as const;

export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

export const ORDER_UPDATE_EVENT_INTENTS = [
  "mark_reviewed_from_operation",
  "mark_reviewed_from_new_orders",
  "request_payment_proof_whatsapp",
] as const;

export type OrderUpdateEventIntent = (typeof ORDER_UPDATE_EVENT_INTENTS)[number];

interface InitialOrderHistoryOptions {
  orderId: string;
  businessSlug: string;
  createdAt: string;
  origin: OrderOrigin;
}

interface OrderHistoryComparableSnapshot {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerWhatsApp: string | null;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  paymentMethod: PaymentMethod;
  products: OrderProduct[];
  notes: string | null;
  total: number;
  isReviewed: boolean;
}

interface AppendOrderHistoryOptions {
  orderId: string;
  occurredAt: string;
  currentHistory: Order["history"];
  currentOrder: OrderHistoryComparableSnapshot;
  nextOrder: OrderHistoryComparableSnapshot;
  eventIntent?: OrderUpdateEventIntent;
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const UPDATE_EVENT_DESCRIPTORS: Array<{
  field: keyof Pick<
    OrderHistoryComparableSnapshot,
    | "status"
    | "paymentStatus"
    | "customerName"
    | "customerWhatsApp"
    | "deliveryType"
    | "deliveryAddress"
    | "paymentMethod"
    | "products"
    | "notes"
    | "total"
  >;
  title: string;
  label: string;
}> = [
  {
    field: "status",
    title: "Estado del pedido actualizado",
    label: "Estado del pedido",
  },
  {
    field: "paymentStatus",
    title: "Estado del pago actualizado",
    label: "Estado del pago",
  },
  {
    field: "customerName",
    title: "Dato principal del pedido actualizado",
    label: "Nombre del cliente",
  },
  {
    field: "customerWhatsApp",
    title: "Dato principal del pedido actualizado",
    label: "WhatsApp del cliente",
  },
  {
    field: "deliveryType",
    title: "Dato principal del pedido actualizado",
    label: "Tipo de entrega",
  },
  {
    field: "deliveryAddress",
    title: "Dato principal del pedido actualizado",
    label: "Direccion de entrega",
  },
  {
    field: "paymentMethod",
    title: "Dato principal del pedido actualizado",
    label: "Metodo de pago",
  },
  {
    field: "products",
    title: "Dato principal del pedido actualizado",
    label: "Articulos",
  },
  {
    field: "notes",
    title: "Dato principal del pedido actualizado",
    label: "Notas",
  },
  {
    field: "total",
    title: "Dato principal del pedido actualizado",
    label: "Total",
  },
];

function createOrderHistoryEvent(
  orderId: string,
  occurredAt: string,
  title: string,
  description: string,
  field?: string,
  previousValue?: string,
  newValue?: string,
): OrderHistoryEvent {
  return {
    id: `${orderId}-${crypto.randomUUID()}`,
    title,
    description,
    occurredAt,
    ...(field ? { field } : {}),
    ...(previousValue ? { previousValue } : {}),
    ...(newValue ? { newValue } : {}),
  };
}

function formatDeliveryType(value: DeliveryType) {
  return value === "domicilio" ? "Domicilio" : "Recogida en tienda";
}

function formatProducts(products: OrderProduct[]) {
  return products
    .map((product) => `${product.quantity} x ${product.name}`)
    .join(", ");
}

function formatComparableFieldValue(
  field: (typeof UPDATE_EVENT_DESCRIPTORS)[number]["field"],
  value: OrderHistoryComparableSnapshot[(typeof UPDATE_EVENT_DESCRIPTORS)[number]["field"]],
) {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  switch (field) {
    case "status":
      return ORDER_STATUS_LABELS[value as OrderStatus] ?? String(value);
    case "paymentStatus":
      return PAYMENT_STATUS_LABELS[value as PaymentStatus] ?? String(value);
    case "deliveryType":
      return formatDeliveryType(value as DeliveryType);
    case "products":
      return formatProducts(value as OrderProduct[]);
    case "total":
      return currencyFormatter.format(value as number);
    default:
      return String(value);
  }
}

function areProductsEqual(left: OrderProduct[], right: OrderProduct[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function didComparableFieldChange(
  currentOrder: OrderHistoryComparableSnapshot,
  nextOrder: OrderHistoryComparableSnapshot,
  field: (typeof UPDATE_EVENT_DESCRIPTORS)[number]["field"],
) {
  if (field === "products") {
    return !areProductsEqual(currentOrder.products, nextOrder.products);
  }

  const previousValue = currentOrder[field];
  const nextValue = nextOrder[field];

  if (typeof previousValue === "number" && typeof nextValue === "number") {
    return previousValue !== nextValue;
  }

  return String(previousValue ?? "").trim() !== String(nextValue ?? "").trim();
}

function buildIntentHistoryEvents(
  options: AppendOrderHistoryOptions,
): OrderHistoryEvent[] {
  if (options.eventIntent === "request_payment_proof_whatsapp") {
    return [
      createOrderHistoryEvent(
        options.orderId,
        options.occurredAt,
        "Mensaje de comprobante preparado para WhatsApp",
        "Se preparo un mensaje manual para solicitar el comprobante de pago al cliente.",
      ),
    ];
  }

  const reviewWasMarked =
    !options.currentOrder.isReviewed && options.nextOrder.isReviewed;

  if (!reviewWasMarked) {
    return [];
  }

  if (options.eventIntent === "mark_reviewed_from_new_orders") {
    return [
      createOrderHistoryEvent(
        options.orderId,
        options.occurredAt,
        "Pedido revisado",
        "El negocio reviso manualmente este pedido desde la bandeja de nuevos.",
      ),
    ];
  }

  if (options.eventIntent === "mark_reviewed_from_operation") {
    return [
      createOrderHistoryEvent(
        options.orderId,
        options.occurredAt,
        "Pedido revisado",
        "El negocio reviso manualmente este pedido desde la operacion.",
      ),
    ];
  }

  return [
    createOrderHistoryEvent(
      options.orderId,
      options.occurredAt,
      "Pedido revisado",
      "El pedido quedo marcado como revisado desde el workspace privado.",
    ),
  ];
}

export function isValidOrderOrigin(value: unknown): value is OrderOrigin {
  return typeof value === "string" && ORDER_ORIGINS.includes(value as OrderOrigin);
}

export function isValidOrderUpdateEventIntent(
  value: unknown,
): value is OrderUpdateEventIntent {
  return (
    typeof value === "string" &&
    ORDER_UPDATE_EVENT_INTENTS.includes(value as OrderUpdateEventIntent)
  );
}

export function resolveOrderPersistenceMode(origin: OrderOrigin) {
  return origin === "workspace_manual" ? "auth" : "public";
}

export function createInitialOrderHistory(
  options: InitialOrderHistoryOptions,
): OrderHistoryEvent[] {
  const originEvent =
    options.origin === "workspace_manual"
      ? {
          id: `${options.businessSlug}-${options.createdAt}-workspace-manual-created`,
          title: "Pedido creado manualmente",
          description:
            "El equipo del negocio registro el pedido manualmente desde el workspace privado.",
        }
      : {
          id: `${options.businessSlug}-${options.createdAt}-public-form-created`,
          title: "Pedido creado desde formulario publico",
          description:
            "El cliente confirmo el pedido desde el formulario publico compartido del negocio.",
        };

  return [
    {
      ...originEvent,
      occurredAt: options.createdAt,
    },
    {
      id: `${options.orderId}-created`,
      title: "Pedido registrado",
      description:
        options.origin === "workspace_manual"
          ? "El pedido manual quedo persistido en la base principal del MVP."
          : "El pedido publico quedo persistido en la base principal del MVP.",
      occurredAt: options.createdAt,
    },
  ];
}

export function appendServerGeneratedOrderHistory(
  options: AppendOrderHistoryOptions,
): Order["history"] {
  const updateEvents = UPDATE_EVENT_DESCRIPTORS.flatMap((descriptor) => {
    if (!didComparableFieldChange(options.currentOrder, options.nextOrder, descriptor.field)) {
      return [];
    }

    const previousValue = formatComparableFieldValue(
      descriptor.field,
      options.currentOrder[descriptor.field],
    );
    const newValue = formatComparableFieldValue(
      descriptor.field,
      options.nextOrder[descriptor.field],
    );

    return [
      createOrderHistoryEvent(
        options.orderId,
        options.occurredAt,
        descriptor.title,
        `${descriptor.label}: "${previousValue}" -> "${newValue}"`,
        descriptor.field,
        previousValue,
        newValue,
      ),
    ];
  });
  const intentEvents = buildIntentHistoryEvents(options);
  const appendedEvents = [...intentEvents, ...updateEvents];

  if (appendedEvents.length === 0) {
    return options.currentHistory;
  }

  return [...appendedEvents, ...options.currentHistory];
}
