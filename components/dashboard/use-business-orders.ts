"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debugError } from "@/lib/debug";
import {
  createWorkspaceOrderViaApi,
  fetchOrdersByBusinessSlug,
  updateOrderViaApi,
} from "@/lib/orders/api";
import { type OrderApiUpdatePayload } from "@/lib/orders/mappers";
import { getAllowedOrderStatusTransitions } from "@/lib/orders/transitions";
import { type OrderUpdateEventIntent } from "@/lib/orders/history-rules";
import { resolveAuthoritativeOrderStatePatch } from "@/lib/orders/state-rules";
import type { DeliveryType, Order, PaymentStatus } from "@/types/orders";
import { DELIVERY_TYPES } from "@/types/orders";
import type { NewOrderFormValue } from "./new-order-drawer";

interface UseBusinessOrdersOptions {
  businessSlug: string;
  orders: Order[];
  initialOrdersError?: string | null;
}

const ORDERS_AUTO_REFRESH_INTERVAL_MS = 15000;

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
  | "isFiado"
  | "fiadoStatus"
  | "fiadoObservation"
>;

type CancelOrderPayload = Pick<
  OrderApiUpdatePayload,
  "cancellationReason" | "cancellationDetail"
>;

function isValidDeliveryType(value: unknown): value is DeliveryType {
  return typeof value === "string" && DELIVERY_TYPES.includes(value as DeliveryType);
}

function buildOrdersSyncError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "No fue posible sincronizar los pedidos en este momento.";
}

function buildOrdersResyncWarning() {
  return "El cambio se guardo, pero no pudimos resincronizar la vista. Recarga o espera el siguiente refresco automatico.";
}

function buildOrderEventIntentPayload(
  eventIntent: OrderUpdateEventIntent,
): Pick<OrderApiUpdatePayload, "eventIntent" | "isReviewed"> {
  return eventIntent === "request_payment_proof_whatsapp"
    ? { eventIntent }
    : {
        eventIntent,
        isReviewed: true,
      };
}

export function useBusinessOrders({
  businessSlug,
  orders,
  initialOrdersError = null,
}: UseBusinessOrdersOptions) {
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
        const remoteOrders = await fetchOrdersByBusinessSlug(businessSlug);
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
    [businessSlug],
  );

  useEffect(() => {
    let isCancelled = false;

    async function hydrateOrders() {
      try {
        const remoteOrders = await fetchOrdersByBusinessSlug(businessSlug);

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
  }, [businessSlug, orders]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    let isRefreshing = false;

    async function refreshInBackground() {
      if (isRefreshing || document.visibilityState !== "visible") {
        return;
      }

      isRefreshing = true;

      try {
        await refreshOrders({ suppressError: true });
      } catch {
        // Preserve current UI state and avoid noisy banners during background refresh.
      } finally {
        isRefreshing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshInBackground();
    }, ORDERS_AUTO_REFRESH_INTERVAL_MS);

    function handleWindowFocus() {
      void refreshInBackground();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshInBackground();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasHydrated, refreshOrders]);

  const newOrders = useMemo(
    () => ordersState.filter((order) => !order.isReviewed),
    [ordersState],
  );

  function getCurrentOrderById(orderId: Order["orderId"]) {
    return ordersStateRef.current.find((order) => order.orderId === orderId) ?? null;
  }

  function hydrateOrdersLocally(nextOrders: Order[]) {
    if (nextOrders.length === 0) {
      return;
    }

    setOrdersState((currentOrders) => {
      const nextOrdersById = new Map(nextOrders.map((order) => [order.orderId, order]));
      const updatedOrders = currentOrders.map(
        (order) => nextOrdersById.get(order.orderId) ?? order,
      );
      const insertedOrders = nextOrders.filter(
        (nextOrder) => !currentOrders.some((order) => order.orderId === nextOrder.orderId),
      );

      return [...insertedOrders, ...updatedOrders];
    });
  }

  async function resyncAfterMutation(persistedOrders: Order[]) {
    try {
      await refreshOrders({ suppressError: true });
      setOrdersError(null);
    } catch (error) {
      hydrateOrdersLocally(persistedOrders);
      setOrdersError(buildOrdersResyncWarning());
      debugError("[dashboard] Orders resync failed after persisted mutation", {
        ordersCount: persistedOrders.length,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async function handleEditOrder(orderId: Order["orderId"], payload: EditableOrderPayload) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      throw new Error("No encontramos el pedido que intentas editar.");
    }

    if (payload.deliveryType !== undefined && !isValidDeliveryType(payload.deliveryType)) {
      throw new Error("Selecciona un tipo de entrega valido.");
    }

    const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
      {
        deliveryType: currentOrder.deliveryType,
        paymentMethod: currentOrder.paymentMethod,
        paymentStatus: currentOrder.paymentStatus,
        status: currentOrder.status,
      },
      {
        deliveryType: payload.deliveryType,
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentStatus,
        status: payload.status,
      },
    );
    const normalizedPayload: EditableOrderPayload = {
      ...payload,
      ...(payload.paymentMethod !== undefined ||
      resolvedStatePatch.changedFields.includes("paymentMethod")
        ? { paymentMethod: resolvedStatePatch.nextState.paymentMethod }
        : {}),
      ...(payload.paymentStatus !== undefined ||
      resolvedStatePatch.changedFields.includes("paymentStatus")
        ? { paymentStatus: resolvedStatePatch.nextState.paymentStatus }
        : {}),
      ...(payload.status !== undefined || resolvedStatePatch.changedFields.includes("status")
        ? { status: resolvedStatePatch.nextState.status }
        : {}),
    };
    const shouldMarkAsReviewed =
      !currentOrder.isReviewed &&
      ((normalizedPayload.status !== undefined &&
        normalizedPayload.status !== currentOrder.status) ||
        (normalizedPayload.paymentStatus !== undefined &&
          normalizedPayload.paymentStatus !== currentOrder.paymentStatus));
    const nextPayload: OrderApiUpdatePayload = {
      ...normalizedPayload,
      ...(shouldMarkAsReviewed ? { isReviewed: true } : {}),
    };

    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, nextPayload);
      await resyncAfterMutation([persistedOrder]);
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Order edit failed", {
        orderId,
        fieldsUpdated: Object.keys(nextPayload ?? {}),
      });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function synchronizeOrderMutation(
    orderId: Order["orderId"],
    buildPayload: (order: Order) => OrderApiUpdatePayload | null,
  ) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      return;
    }

    const nextPayload = buildPayload(currentOrder);

    if (!nextPayload) {
      return;
    }

    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, nextPayload);
      await resyncAfterMutation([persistedOrder]);
    } catch (error) {
      debugError("[dashboard] Order mutation failed", { orderId });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function synchronizeBulkOrderMutation(
    orderIds: Array<Order["orderId"]>,
    buildPayload: (order: Order) => OrderApiUpdatePayload | null,
  ) {
    if (orderIds.length === 0) {
      return;
    }

    const currentOrders = ordersStateRef.current;
    const orderMutations = currentOrders
      .filter((order) => orderIds.includes(order.orderId))
      .map((order) => ({ order, payload: buildPayload(order) }))
      .filter(
        (
          mutation,
        ): mutation is { order: Order; payload: OrderApiUpdatePayload } => mutation.payload !== null,
      );

    setOrdersError(null);

    try {
      const persistedOrders = await Promise.all(
        orderMutations.map(({ order, payload }) =>
          updateOrderViaApi(order.orderId, payload),
        ),
      );
      await resyncAfterMutation(persistedOrders);
    } catch (error) {
      debugError("[dashboard] Bulk order mutation failed", {
        ordersCount: orderIds.length,
      });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  function handleMarkAsReviewed(orderId: Order["orderId"]) {
    void synchronizeOrderMutation(orderId, (order) =>
      order.isReviewed
        ? null
        : buildOrderEventIntentPayload("mark_reviewed_from_operation"),
    ).catch(() => {
      // The banner already communicates the failure.
    });
  }

  function handleMarkAllAsReviewed() {
    const pendingOrderIds = ordersStateRef.current
      .filter((order) => !order.isReviewed)
      .map((order) => order.orderId);

    void synchronizeBulkOrderMutation(pendingOrderIds, (order) =>
      order.isReviewed
        ? null
        : buildOrderEventIntentPayload("mark_reviewed_from_new_orders"),
    ).catch(() => {
      // The banner already communicates the failure.
    });
  }

  async function handleRequestPaymentProof(orderId: Order["orderId"]) {
    const currentOrder = getCurrentOrderById(orderId);

    if (!currentOrder) {
      return false;
    }

    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(
        orderId,
        buildOrderEventIntentPayload("request_payment_proof_whatsapp"),
      );
      await resyncAfterMutation([persistedOrder]);
      return true;
    } catch (error) {
      debugError("[dashboard] Payment proof request failed", { orderId });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function handleUpdatePaymentStatus(
    orderId: Order["orderId"],
    paymentStatus: PaymentStatus,
  ) {
    return handleEditOrder(orderId, { paymentStatus });
  }

  async function handleConfirmOrder(orderId: Order["orderId"]) {
    return handleEditOrder(orderId, { status: "confirmado" });
  }

  async function handleAdvanceOrderStatus(orderId: Order["orderId"]) {
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

  async function handleCancelOrder(
    orderId: Order["orderId"],
    payload: CancelOrderPayload,
  ) {
    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, {
        status: "cancelado",
        cancellationReason: payload.cancellationReason,
        cancellationDetail: payload.cancellationDetail ?? null,
      });
      await resyncAfterMutation([persistedOrder]);
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Order cancellation failed", { orderId });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function handleReactivateOrder(orderId: Order["orderId"]) {
    setOrdersError(null);

    try {
      const persistedOrder = await updateOrderViaApi(orderId, {
        reactivateCancelledOrder: true,
      });
      await resyncAfterMutation([persistedOrder]);
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Order reactivation failed", { orderId });
      await refreshOrders({ suppressError: true });
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  async function handleCreateOrder(input: NewOrderFormValue) {
    setOrdersError(null);

    try {
      const persistedOrder = await createWorkspaceOrderViaApi({
        businessSlug,
        customerName: input.client,
        customerWhatsApp: input.customerWhatsApp,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryAddress,
        paymentMethod: input.paymentMethod,
        notes: input.observations,
        total: input.total,
        products: input.products,
      });

      await resyncAfterMutation([persistedOrder]);
      return persistedOrder;
    } catch (error) {
      debugError("[dashboard] Manual order creation failed", { businessSlug });
      try {
        await refreshOrders({ suppressError: true });
      } catch {
        // Keep the original mutation error as the main user-facing signal.
      }
      setOrdersError(buildOrdersSyncError(error));
      throw error;
    }
  }

  function handleResetOrders() {
    setOrdersState(orders);
    setOrdersError(initialOrdersError);
  }

  function handleHydrateOrder(order: Order) {
    hydrateOrdersLocally([order]);
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
    handleReactivateOrder,
    handleHydrateOrder,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  };
}
