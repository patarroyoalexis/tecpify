"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debugError } from "@/lib/debug";
import {
  createOrderViaApi,
  fetchOrdersByBusinessSlug,
  updateOrderViaApi,
} from "@/lib/orders/api";
import {
  getInitialOrderState,
  type OrderApiUpdatePayload,
} from "@/lib/orders/mappers";
import {
  getAllowedOrderStatusTransitions,
  getOrderStatusTransitionRule,
  getPaymentStatusTransitionRule,
  isPaymentConfirmed,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/transitions";
import type {
  DeliveryType,
  Order,
  OrderHistoryEvent,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";
import { DELIVERY_TYPES } from "@/types/orders";
import type { NewOrderFormValue } from "./new-order-drawer";

interface UseBusinessOrdersOptions {
  businessId: string;
  businessSlug?: string;
  orders: Order[];
  initialOrdersError?: string | null;
}

type EditableOrderPayload = Pick<
  OrderApiUpdatePayload,
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

function createHistoryEvent(
  orderId: string,
  title: string,
  description: string,
  field?: string,
  previousValue?: string,
  newValue?: string,
): OrderHistoryEvent {
  return {
    id: `${orderId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    description,
    occurredAt: new Date().toISOString(),
    field,
    previousValue,
    newValue,
  };
}

function isValidDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPES.includes(value as DeliveryType);
}

function buildDateLabel(createdAt: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function formatOrderValue(field: keyof EditableOrderPayload, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  if (field === "status" && typeof value === "string") {
    return ORDER_STATUS_LABELS[value as OrderStatus] ?? value;
  }

  if (field === "paymentStatus" && typeof value === "string") {
    return PAYMENT_STATUS_LABELS[value as PaymentStatus] ?? value;
  }

  if (field === "deliveryType" && typeof value === "string") {
    return value === "domicilio" ? "Domicilio" : "Recogida en tienda";
  }

  if (field === "total" && typeof value === "number") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (field === "products" && Array.isArray(value)) {
    return value
      .map((product) =>
        product && typeof product === "object"
          ? `${String((product as Order["products"][number]).quantity)} x ${String((product as Order["products"][number]).name)}`
          : "",
      )
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

function getFieldLabel(field: keyof EditableOrderPayload): string {
  switch (field) {
    case "status":
      return "Estado del pedido";
    case "paymentStatus":
      return "Estado del pago";
    case "customerName":
      return "Nombre del cliente";
    case "customerWhatsApp":
      return "WhatsApp del cliente";
    case "deliveryType":
      return "Tipo de entrega";
    case "deliveryAddress":
      return "Direccion de entrega";
    case "paymentMethod":
      return "Metodo de pago";
    case "products":
      return "Articulos";
    case "notes":
      return "Notas";
    case "total":
      return "Total";
    default:
      return "Pedido";
  }
}

function getCurrentFieldValue(order: Order, field: keyof EditableOrderPayload) {
  switch (field) {
    case "status":
      return order.status;
    case "paymentStatus":
      return order.paymentStatus;
    case "customerName":
      return order.client;
    case "customerWhatsApp":
      return order.customerPhone ?? "";
    case "deliveryType":
      return order.deliveryType;
    case "deliveryAddress":
      return order.address ?? "";
    case "paymentMethod":
      return order.paymentMethod;
    case "products":
      return order.products;
    case "notes":
      return order.observations ?? "";
    case "total":
      return order.total;
    default:
      return undefined;
  }
}

function buildOrderHistoryEvents(order: Order, payload: EditableOrderPayload): OrderHistoryEvent[] {
  return (Object.keys(payload) as Array<keyof EditableOrderPayload>)
    .filter((field) => {
      const previousValue = getCurrentFieldValue(order, field);
      const nextValue = payload[field];

      if (typeof previousValue === "number" && typeof nextValue === "number") {
        return previousValue !== nextValue;
      }

      return String(previousValue ?? "").trim() !== String(nextValue ?? "").trim();
    })
    .map((field) => {
      const previousValue = getCurrentFieldValue(order, field);
      const nextValue = payload[field];
      const formattedPreviousValue = formatOrderValue(field, previousValue);
      const formattedNextValue = formatOrderValue(field, nextValue);
      const fieldLabel = getFieldLabel(field);

      return createHistoryEvent(
        order.id,
        field === "status"
          ? "Estado del pedido actualizado"
          : field === "paymentStatus"
            ? "Estado del pago actualizado"
            : "Dato principal del pedido actualizado",
        `${fieldLabel}: "${formattedPreviousValue}" -> "${formattedNextValue}"`,
        field,
        formattedPreviousValue,
        formattedNextValue,
      );
    });
}

function buildOrdersSyncError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "No fue posible sincronizar los pedidos en este momento.";
}

export function useBusinessOrders({
  businessId,
  businessSlug,
  orders,
  initialOrdersError = null,
}: UseBusinessOrdersOptions) {
  const resolvedBusinessSlug = businessSlug ?? businessId;
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [ordersError, setOrdersError] = useState<string | null>(initialOrdersError);
  const [hasHydrated, setHasHydrated] = useState(false);
  const ordersStateRef = useRef<Order[]>(orders);

  useEffect(() => {
    ordersStateRef.current = ordersState;
  }, [ordersState]);

  const refreshOrders = useCallback(
    async (options?: { suppressError?: boolean }) => {
      try {
        const remoteOrders = await fetchOrdersByBusinessSlug(resolvedBusinessSlug);
        setOrdersState(remoteOrders);
        setOrdersError(null);
        return remoteOrders;
      } catch (error) {
        if (!options?.suppressError) {
          setOrdersError(buildOrdersSyncError(error));
        }
        throw error;
      }
    },
    [resolvedBusinessSlug],
  );

  useEffect(() => {
    let isCancelled = false;

    async function hydrateOrders() {
      try {
        const remoteOrders = await fetchOrdersByBusinessSlug(resolvedBusinessSlug);

        if (!isCancelled) {
          setOrdersState(remoteOrders);
          setOrdersError(null);
          setHasHydrated(true);
        }
      } catch (error) {
        if (!isCancelled) {
          setOrdersState(orders);
          setOrdersError(buildOrdersSyncError(error));
          setHasHydrated(true);
        }
      }
    }

    void hydrateOrders();

    return () => {
      isCancelled = true;
    };
  }, [orders, resolvedBusinessSlug]);

  const newOrders = useMemo(
    () => ordersState.filter((order) => !order.isReviewed),
    [ordersState],
  );

  function appendOrderEvent(
    order: Order,
    title: string,
    description: string,
  ): OrderHistoryEvent[] {
    return [createHistoryEvent(order.id, title, description), ...order.history];
  }

  function getCurrentOrderById(orderId: string) {
    return ordersStateRef.current.find((order) => order.id === orderId) ?? null;
  }

  async function handleEditOrder(orderId: string, payload: EditableOrderPayload) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      throw new Error("No encontramos el pedido que intentas editar.");
    }

    const nextPaymentStatus = payload.paymentStatus ?? currentOrder.paymentStatus;

    if (
      payload.status !== undefined &&
      payload.status !== currentOrder.status &&
      !isPaymentConfirmed(nextPaymentStatus)
    ) {
      throw new Error(
        "Confirma el pago primero para habilitar los cambios en el estado del pedido.",
      );
    }

    if (payload.status !== undefined) {
      const statusRule = getOrderStatusTransitionRule(currentOrder, payload.status);

      if (!statusRule.allowed) {
        throw new Error(statusRule.reason ?? "Ese cambio de estado no esta permitido.");
      }
    }

    if (payload.paymentStatus !== undefined) {
      const paymentRule = getPaymentStatusTransitionRule(currentOrder, payload.paymentStatus);

      if (!paymentRule.allowed) {
        throw new Error(paymentRule.reason ?? "Ese cambio de pago no esta permitido.");
      }
    }

    if (payload.deliveryType !== undefined && !isValidDeliveryType(payload.deliveryType)) {
      throw new Error("Selecciona un tipo de entrega valido.");
    }

    const nextHistory = [
      ...buildOrderHistoryEvents(currentOrder, payload),
      ...currentOrder.history,
    ];
    const shouldMarkAsReviewed =
      !currentOrder.isReviewed &&
      ((payload.status !== undefined && payload.status !== currentOrder.status) ||
        (payload.paymentStatus !== undefined &&
          payload.paymentStatus !== currentOrder.paymentStatus));
    const nextPayload: OrderApiUpdatePayload = {
      ...payload,
      ...(shouldMarkAsReviewed ? { isReviewed: true } : {}),
      history: nextHistory,
    };

    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, nextPayload);
      await refreshOrders({ suppressError: true });
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Order edit failed", {
        orderId,
        fieldsUpdated: Object.keys(nextPayload ?? {}),
      });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function synchronizeOrderMutation(
    orderId: string,
    computeNextOrder: (order: Order) => Order,
  ) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      return;
    }

    const nextOrder = computeNextOrder(currentOrder);

    if (nextOrder === currentOrder) {
      return;
    }

    setOrdersError(null);

    try {
      await updateOrderViaApi(orderId, {
        status: nextOrder.status,
        paymentStatus: nextOrder.paymentStatus,
        isReviewed: nextOrder.isReviewed,
        history: nextOrder.history,
      });
      await refreshOrders({ suppressError: true });
    } catch (error) {
      debugError("[dashboard] Order mutation failed", { orderId });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function synchronizeBulkOrderMutation(
    orderIds: string[],
    computeNextOrder: (order: Order) => Order,
  ) {
    if (orderIds.length === 0) {
      return;
    }

    const currentOrders = ordersStateRef.current;
    const ordersToUpdate = currentOrders
      .filter((order) => orderIds.includes(order.id))
      .map((order) => computeNextOrder(order));

    setOrdersError(null);

    try {
      await Promise.all(
        ordersToUpdate.map((order) =>
          updateOrderViaApi(order.id, {
            status: order.status,
            paymentStatus: order.paymentStatus,
            isReviewed: order.isReviewed,
            history: order.history,
          }),
        ),
      );
      await refreshOrders({ suppressError: true });
    } catch (error) {
      debugError("[dashboard] Bulk order mutation failed", {
        ordersCount: orderIds.length,
      });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  function handleMarkAsReviewed(orderId: string) {
    void synchronizeOrderMutation(orderId, (order) =>
      order.isReviewed
        ? order
        : {
            ...order,
            isReviewed: true,
            history: appendOrderEvent(
              order,
              "Pedido revisado",
              "El negocio reviso manualmente este pedido desde la operacion.",
            ),
          },
    ).catch(() => {
      // The banner already communicates the failure.
    });
  }

  function handleMarkAllAsReviewed() {
    const pendingOrderIds = ordersStateRef.current
      .filter((order) => !order.isReviewed)
      .map((order) => order.id);

    void synchronizeBulkOrderMutation(pendingOrderIds, (order) =>
      order.isReviewed
        ? order
        : {
            ...order,
            isReviewed: true,
            history: appendOrderEvent(
              order,
              "Pedido revisado",
              "El negocio reviso manualmente este pedido desde la bandeja de nuevos.",
            ),
          },
    ).catch(() => {
      // The banner already communicates the failure.
    });
  }

  async function handleRequestPaymentProof(orderId: string) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      return false;
    }

    setOrdersError(null);

    try {
      await updateOrderViaApi(orderId, {
        history: appendOrderEvent(
          currentOrder,
          "Mensaje de comprobante preparado para WhatsApp",
          "Se preparo un mensaje manual para solicitar el comprobante de pago al cliente.",
        ),
      });
      await refreshOrders({ suppressError: true });
      return true;
    } catch (error) {
      debugError("[dashboard] Payment proof request failed", { orderId });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function handleUpdatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    return handleEditOrder(orderId, { paymentStatus });
  }

  async function handleConfirmOrder(orderId: string) {
    return handleEditOrder(orderId, { status: "confirmado" });
  }

  async function handleAdvanceOrderStatus(orderId: string) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      return;
    }

    const nextStatus = getAllowedOrderStatusTransitions(currentOrder.status).find(
      (statusOption) =>
        statusOption !== currentOrder.status && statusOption !== "cancelado",
    );

    if (!nextStatus) {
      return;
    }

    return handleEditOrder(orderId, { status: nextStatus });
  }

  async function handleCancelOrder(orderId: string) {
    return handleEditOrder(orderId, { status: "cancelado" });
  }

  async function handleCreateOrder(input: NewOrderFormValue) {
    const createdAt = new Date().toISOString();
    const initialState = getInitialOrderState(input.paymentMethod as PaymentMethod);
    const history: OrderHistoryEvent[] = [
      {
        id: `${businessId}-${createdAt}-manual-created`,
        title: "Pedido creado manualmente",
        description: "El pedido fue registrado desde el centro operativo.",
        occurredAt: createdAt,
      },
    ];

    setOrdersError(null);

    try {
      const persistedOrder = await createOrderViaApi({
        businessSlug: resolvedBusinessSlug,
        customerName: input.client,
        customerWhatsApp: input.customerWhatsApp,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryAddress,
        paymentMethod: input.paymentMethod,
        notes: input.observations,
        total: input.total,
        status: initialState.status,
        products: input.products,
        paymentStatus: initialState.paymentStatus,
        dateLabel: `Hoy, ${buildDateLabel(createdAt)}`,
        isReviewed: false,
        history,
      });

      await refreshOrders({ suppressError: true });
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Manual order creation failed", { businessId });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  function handleResetOrders() {
    setOrdersState(orders);
    setOrdersError(initialOrdersError);
  }

  function handleHydrateOrder(order: Order) {
    setOrdersState((currentOrders) => {
      const orderIndex = currentOrders.findIndex((currentOrder) => currentOrder.id === order.id);

      if (orderIndex === -1) {
        return [order, ...currentOrders];
      }

      return currentOrders.map((currentOrder) =>
        currentOrder.id === order.id ? order : currentOrder,
      );
    });
  }

  return {
    hasHydrated,
    newOrders,
    ordersError,
    ordersState,
    handleAdvanceOrderStatus,
    handleCancelOrder,
    handleConfirmOrder,
    handleCreateOrder,
    handleEditOrder,
    handleMarkAllAsReviewed,
    handleMarkAsReviewed,
    handleHydrateOrder,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  };
}
