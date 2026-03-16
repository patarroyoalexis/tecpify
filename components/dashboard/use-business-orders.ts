"use client";

import { useEffect, useMemo, useState } from "react";

import { isDigitalPayment } from "@/components/dashboard/payment-helpers";
import {
  getBusinessOrdersStorageKey,
  readOrdersForBusiness,
  writeOrdersForBusiness,
} from "@/data/order-storage";
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

function getInitialOrderState(paymentMethod: PaymentMethod) {
  if (isDigitalPayment(paymentMethod)) {
    return {
      paymentStatus: "pendiente" as PaymentStatus,
      status: "pendiente de pago" as OrderStatus,
    };
  }

  return {
    paymentStatus: "verificado" as PaymentStatus,
    status: "confirmado" as OrderStatus,
  };
}

export function useBusinessOrders({
  businessId,
  orders,
}: UseBusinessOrdersOptions) {
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const persistedOrders = readOrdersForBusiness(businessId);

    queueMicrotask(() => {
      if (persistedOrders && persistedOrders.every(isValidOrder)) {
        setOrdersState(
          persistedOrders.filter((order) => order.businessId === businessId),
        );
      } else {
        setOrdersState(orders);
      }

      setHasHydrated(true);
    });
  }, [businessId, orders]);

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

  function updateOrder(orderId: string, updater: (order: Order) => Order) {
    setOrdersState((currentOrders) =>
      currentOrders.map((order) => (order.id === orderId ? updater(order) : order)),
    );
  }

  function appendOrderEvent(
    order: Order,
    title: string,
    description: string,
  ): OrderHistoryEvent[] {
    return [createHistoryEvent(order.id, title, description), ...order.history];
  }

  function handleMarkAsReviewed(orderId: string) {
    updateOrder(orderId, (order) =>
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
    setOrdersState((currentOrders) =>
      currentOrders.map((order) =>
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
      ),
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
    updateOrder(orderId, (order) => ({
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
    updateOrder(orderId, (order) => {
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
    updateOrder(orderId, (order) => {
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
    updateOrder(orderId, (order) => {
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
      const initialState = getInitialOrderState(input.paymentMethod);
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
