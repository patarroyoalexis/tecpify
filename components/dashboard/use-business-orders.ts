"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getBusinessOrdersStorageKey,
  readOrdersForBusiness,
  writeOrdersForBusiness,
} from "@/data/order-storage";
import { fetchOrdersByBusinessSlug, updateOrderViaApi } from "@/lib/orders/api";
import { getInitialOrderState } from "@/lib/orders/mappers";
import type {
  Order,
  OrderHistoryEvent,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";
import { ORDER_STATUSES } from "@/types/orders";
import type { NewOrderFormValue } from "./new-order-drawer";

interface UseBusinessOrdersOptions {
  businessId: string;
  businessSlug?: string;
  orders: Order[];
}

function createHistoryEvent(
  orderId: string,
  title: string,
  description: string,
): OrderHistoryEvent {
  return {
    id: `${orderId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    description,
    occurredAt: new Date().toISOString(),
  };
}

function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
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
          // Transitional fallback: keep a local snapshot while the migration finishes.
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

    // Transitional fallback: localStorage still mirrors the current view in case Supabase is unavailable.
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
    } catch (error) {
      console.error("[dashboard] order mutation rollback", { orderId, error });
      setOrdersState(previousOrders);
      persistOrdersFallback(previousOrders);
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
    } catch (error) {
      console.error("[dashboard] bulk order mutation rollback", { orderIds, error });
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
              "El negocio reviso manualmente este pedido desde la operacion.",
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
              "El negocio reviso manualmente este pedido desde la bandeja de nuevos.",
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
        "Se preparo un mensaje manual para solicitar el comprobante de pago al cliente.",
      ),
    }));

    return Promise.resolve(true);
  }

  function handleUpdatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    void synchronizeOrderMutation(orderId, (order) => ({
      ...order,
      paymentStatus,
      history: appendOrderEvent(
        order,
        paymentStatus === "verificado"
          ? "Pago marcado como verificado"
          : paymentStatus === "con novedad"
            ? "Pago marcado con novedad"
            : "Pago marcado como no verificado",
        `El estado del pago cambio manualmente a ${paymentStatus}.`,
      ),
    }));
  }

  function handleConfirmOrder(orderId: string) {
    void synchronizeOrderMutation(orderId, (order) => {
      const canConfirm =
        order.paymentStatus === "verificado" &&
        (order.status === "pendiente de pago" || order.status === "pago por verificar");

      if (!canConfirm) {
        return order;
      }

      return {
        ...order,
        status: "confirmado",
        history: appendOrderEvent(
          order,
          "Pedido confirmado",
          "El pedido paso manualmente a confirmado despues de verificar el pago.",
        ),
      };
    });
  }

  function handleAdvanceOrderStatus(orderId: string) {
    void synchronizeOrderMutation(orderId, (order) => {
      if (order.status === "cancelado") {
        return order;
      }

      if (order.status === "confirmado") {
        return {
          ...order,
          status: "en preparación",
          history: appendOrderEvent(
            order,
            "Pedido en preparacion",
            "El pedido paso a preparacion desde el detalle operativo.",
          ),
        };
      }

      if (order.status === "en preparación") {
        return {
          ...order,
          status: "listo",
          history: appendOrderEvent(
            order,
            "Pedido listo",
            "El pedido quedo listo para entrega o recogida.",
          ),
        };
      }

      if (order.status === "listo") {
        return {
          ...order,
          status: "entregado",
          history: appendOrderEvent(
            order,
            "Pedido entregado",
            "El pedido fue marcado como entregado en la operacion manual.",
          ),
        };
      }

      return order;
    });
  }

  function handleCancelOrder(orderId: string) {
    void synchronizeOrderMutation(orderId, (order) => {
      if (order.status === "entregado" || order.status === "cancelado") {
        return order;
      }

      return {
        ...order,
        status: "cancelado",
        history: appendOrderEvent(
          order,
          "Pedido cancelado",
          "El pedido fue cancelado manualmente desde el detalle operativo.",
        ),
      };
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
    handleMarkAllAsReviewed,
    handleMarkAsReviewed,
    handleHydrateOrder,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  };
}
