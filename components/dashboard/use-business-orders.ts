"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getBusinessOrdersStorageKey,
  readOrdersForBusiness,
  writeOrdersForBusiness,
} from "@/data/order-storage";
import { debugError } from "@/lib/debug";
import { fetchOrdersByBusinessSlug, updateOrderViaApi } from "@/lib/orders/api";
import { getInitialOrderState, type OrderApiUpdatePayload } from "@/lib/orders/mappers";
import {
  getAllowedOrderStatusTransitions,
  isPaymentConfirmed,
  getOrderStatusTransitionRule,
  getPaymentStatusTransitionRule,
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
import { DELIVERY_TYPES, ORDER_STATUSES } from "@/types/orders";
import type { NewOrderFormValue } from "./new-order-drawer";

interface UseBusinessOrdersOptions {
  businessId: string;
  businessSlug?: string;
  orders: Order[];
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

function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

function isValidDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPES.includes(value as DeliveryType);
}

function isValidOrder(order: unknown): order is Order {
  if (!order || typeof order !== "object") {
    return false;
  }

  const candidate = order as Partial<Order>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.businessId === "string" &&
    typeof candidate.client === "string" &&
    Array.isArray(candidate.products) &&
    typeof candidate.total === "number" &&
    typeof candidate.paymentMethod === "string" &&
    typeof candidate.paymentStatus === "string" &&
    typeof candidate.deliveryType === "string" &&
    isValidOrderStatus(candidate.status) &&
    typeof candidate.dateLabel === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.isReviewed === "boolean" &&
    Array.isArray(candidate.history)
  );
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
      return "Dirección de entrega";
    case "paymentMethod":
      return "Método de pago";
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

function applyOrderUpdatePayload(order: Order, payload: OrderApiUpdatePayload): Order {
  return {
    ...order,
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.paymentStatus !== undefined
      ? { paymentStatus: payload.paymentStatus }
      : {}),
    ...(payload.customerName !== undefined ? { client: payload.customerName.trim() } : {}),
    ...(payload.customerWhatsApp !== undefined
      ? { customerPhone: payload.customerWhatsApp.trim() }
      : {}),
    ...(payload.deliveryType !== undefined ? { deliveryType: payload.deliveryType } : {}),
    ...(payload.deliveryAddress !== undefined
      ? { address: payload.deliveryAddress?.trim() || undefined }
      : {}),
    ...(payload.paymentMethod !== undefined ? { paymentMethod: payload.paymentMethod } : {}),
    ...(payload.notes !== undefined
      ? { observations: payload.notes?.trim() || undefined }
      : {}),
    ...(payload.total !== undefined ? { total: payload.total } : {}),
    ...(payload.isReviewed !== undefined ? { isReviewed: payload.isReviewed } : {}),
    ...(payload.history !== undefined ? { history: payload.history } : {}),
  };
}

function generateNextOrderId(currentOrders: Order[]) {
  const maxId = currentOrders.reduce((maxValue, order) => {
    const numericValue = Number(order.id.replace("TEC-", ""));
    return Number.isFinite(numericValue) ? Math.max(maxValue, numericValue) : maxValue;
  }, 1000);

  return `TEC-${maxId + 1}`;
}

function getFallbackOrders(businessId: string, orders: Order[]) {
  const persistedOrders = readOrdersForBusiness(businessId);

  if (persistedOrders && persistedOrders.every(isValidOrder)) {
    return persistedOrders.filter((order) => order.businessId === businessId);
  }

  return orders;
}

export function useBusinessOrders({
  businessId,
  businessSlug,
  orders,
}: UseBusinessOrdersOptions) {
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateOrders() {
      const resolvedBusinessSlug = businessSlug ?? businessId;

      try {
        const remoteOrders = await fetchOrdersByBusinessSlug(resolvedBusinessSlug);

        if (!isCancelled) {
          setOrdersState(remoteOrders);
          writeOrdersForBusiness(businessId, remoteOrders);
          setHasHydrated(true);
        }
      } catch {
        if (!isCancelled) {
          setOrdersState(getFallbackOrders(businessId, orders));
          setHasHydrated(true);
        }
      }
    }

    void hydrateOrders();

    return () => {
      isCancelled = true;
    };
  }, [businessId, businessSlug, orders]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    writeOrdersForBusiness(businessId, ordersState);
  }, [businessId, hasHydrated, ordersState]);

  const newOrders = useMemo(
    () => ordersState.filter((order) => !order.isReviewed),
    [ordersState],
  );

  function replaceOrderInState(currentOrders: Order[], nextOrder: Order) {
    const orderIndex = currentOrders.findIndex((order) => order.id === nextOrder.id);

    if (orderIndex === -1) {
      return [nextOrder, ...currentOrders];
    }

    return currentOrders.map((order) => (order.id === nextOrder.id ? nextOrder : order));
  }

  function persistOrdersFallback(nextOrders: Order[]) {
    try {
      writeOrdersForBusiness(businessId, nextOrders);
    } catch {
      // Transitional fallback should never block the operational flow.
    }
  }

  function updateOrder(orderId: string, updater: (order: Order) => Order) {
    setOrdersState((currentOrders) => {
      const nextOrders = currentOrders.map((order) =>
        order.id === orderId ? updater(order) : order,
      );
      persistOrdersFallback(nextOrders);
      return nextOrders;
    });
  }

  function appendOrderEvent(
    order: Order,
    title: string,
    description: string,
  ): OrderHistoryEvent[] {
    return [createHistoryEvent(order.id, title, description), ...order.history];
  }

  async function synchronizeOrderMutation(
    orderId: string,
    computeNextOrder: (order: Order) => Order,
  ) {
    const currentOrder = ordersState.find((order) => order.id === orderId);

    if (!currentOrder) {
      return;
    }

    const nextOrder = computeNextOrder(currentOrder);

    if (nextOrder === currentOrder) {
      return;
    }

    const previousOrders = ordersState;
    const optimisticOrders = replaceOrderInState(previousOrders, nextOrder);
    setOrdersState(optimisticOrders);
    persistOrdersFallback(optimisticOrders);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, {
        status: nextOrder.status,
        paymentStatus: nextOrder.paymentStatus,
        isReviewed: nextOrder.isReviewed,
        history: nextOrder.history,
      });

      setOrdersState((currentOrders) => {
        const syncedOrders = replaceOrderInState(currentOrders, persistedOrder);
        persistOrdersFallback(syncedOrders);
        return syncedOrders;
      });
    } catch {
      debugError("[dashboard] Order mutation rollback", { orderId });
      setOrdersState(previousOrders);
      persistOrdersFallback(previousOrders);
    }
  }

  async function handleEditOrder(orderId: string, payload: EditableOrderPayload) {
    const currentOrder = ordersState.find((order) => order.id === orderId);

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
        throw new Error(statusRule.reason ?? "Ese cambio de estado no está permitido.");
      }
    }

    if (payload.paymentStatus !== undefined) {
      const paymentRule = getPaymentStatusTransitionRule(currentOrder, payload.paymentStatus);

      if (!paymentRule.allowed) {
        throw new Error(paymentRule.reason ?? "Ese cambio de pago no está permitido.");
      }
    }

    if (payload.deliveryType !== undefined && !isValidDeliveryType(payload.deliveryType)) {
      throw new Error("Selecciona un tipo de entrega válido.");
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
    const optimisticPayload: OrderApiUpdatePayload = {
      ...payload,
      ...(shouldMarkAsReviewed ? { isReviewed: true } : {}),
      history: nextHistory,
    };
    const optimisticOrder = applyOrderUpdatePayload(currentOrder, optimisticPayload);
    const previousOrders = ordersState;
    const optimisticOrders = replaceOrderInState(previousOrders, optimisticOrder);

    setOrdersState(optimisticOrders);
    persistOrdersFallback(optimisticOrders);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, optimisticPayload);

      setOrdersState((currentOrders) => {
        const syncedOrders = replaceOrderInState(currentOrders, persistedOrder);
        persistOrdersFallback(syncedOrders);
        return syncedOrders;
      });

      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Order edit rollback", {
        orderId,
        fieldsUpdated: Object.keys(optimisticPayload ?? {}),
      });
      setOrdersState(previousOrders);
      persistOrdersFallback(previousOrders);
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

    const previousOrders = ordersState;
    const optimisticOrders = previousOrders.map((order) =>
      orderIds.includes(order.id) ? computeNextOrder(order) : order,
    );

    setOrdersState(optimisticOrders);
    persistOrdersFallback(optimisticOrders);

    try {
      const persistedOrders = await Promise.all(
        optimisticOrders
          .filter((order) => orderIds.includes(order.id))
          .map((order) =>
            updateOrderViaApi(order.id, {
              status: order.status,
              paymentStatus: order.paymentStatus,
              isReviewed: order.isReviewed,
              history: order.history,
            }),
          ),
      );

      setOrdersState((currentOrders) => {
        const syncedOrders = persistedOrders.reduce(
          (nextOrders, persistedOrder) => replaceOrderInState(nextOrders, persistedOrder),
          currentOrders,
        );
        persistOrdersFallback(syncedOrders);
        return syncedOrders;
      });
    } catch {
      debugError("[dashboard] Bulk order mutation rollback", {
        ordersCount: orderIds.length,
      });
      setOrdersState(previousOrders);
      persistOrdersFallback(previousOrders);
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
              "El negocio revisó manualmente este pedido desde la operación.",
            ),
          },
    );
  }

  function handleMarkAllAsReviewed() {
    const pendingOrderIds = ordersState
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
              "El negocio revisó manualmente este pedido desde la bandeja de nuevos.",
            ),
          },
    );
  }

  function handleRequestPaymentProof(orderId: string) {
    updateOrder(orderId, (order) => ({
      ...order,
      history: appendOrderEvent(
        order,
        "Mensaje de comprobante preparado para WhatsApp",
        "Se preparó un mensaje manual para solicitar el comprobante de pago al cliente.",
      ),
    }));

    return Promise.resolve(true);
  }

  function handleUpdatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    void handleEditOrder(orderId, { paymentStatus }).catch(() => {
      debugError("[dashboard] Payment status mutation failed", { orderId });
    });
  }

  function handleConfirmOrder(orderId: string) {
    void handleEditOrder(orderId, { status: "confirmado" }).catch(() => {
      debugError("[dashboard] Confirm order mutation failed", { orderId });
    });
  }

  function handleAdvanceOrderStatus(orderId: string) {
    const currentOrder = ordersState.find((order) => order.id === orderId);

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

    void handleEditOrder(orderId, { status: nextStatus }).catch(() => {
      debugError("[dashboard] Advance order mutation failed", { orderId });
    });
  }

  function handleCancelOrder(orderId: string) {
    void handleEditOrder(orderId, { status: "cancelado" }).catch(() => {
      debugError("[dashboard] Cancel order mutation failed", { orderId });
    });
  }

  function handleCreateOrder(input: NewOrderFormValue) {
    const createdAt = new Date().toISOString();

    setOrdersState((currentOrders) => {
      const orderId = generateNextOrderId(currentOrders);
      const initialState = getInitialOrderState(input.paymentMethod as PaymentMethod);
      const newOrder: Order = {
        id: orderId,
        businessId,
        client: input.client,
        products: input.products,
        total: input.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: initialState.paymentStatus,
        deliveryType: input.deliveryType,
        status: initialState.status,
        dateLabel: `Hoy, ${buildDateLabel(createdAt)}`,
        createdAt,
        isReviewed: false,
        history: [
          {
            id: `${orderId}-created-manually`,
            title: "Pedido creado manualmente",
            description: "El pedido fue registrado desde el centro operativo.",
            occurredAt: createdAt,
          },
        ],
        observations: input.observations,
      };

      return [newOrder, ...currentOrders];
    });
  }

  function handleResetOrders() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getBusinessOrdersStorageKey(businessId));
    }

    setOrdersState(orders);
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
