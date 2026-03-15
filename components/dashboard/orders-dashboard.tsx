"use client";

import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { NewOrdersSection } from "@/components/dashboard/new-orders-section";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import { isDigitalPayment } from "@/components/dashboard/payment-helpers";
import {
  NewOrderDrawer,
  type NewOrderFormValue,
} from "@/components/dashboard/new-order-drawer";
import {
  defaultExpandedGroupsState,
  OrdersList,
  type GroupKey,
} from "@/components/dashboard/orders-list";
import { OrdersFilters } from "@/components/dashboard/orders-filters";
import {
  getBusinessDashboardStateKey,
  getBusinessOrdersStorageKey,
  readOrdersForBusiness,
  writeOrdersForBusiness,
} from "@/data/order-storage";
import { getDashboardMetrics } from "@/data/orders";
import type {
  Order,
  OrderHistoryEvent,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";
import { ORDER_STATUSES } from "@/types/orders";

interface OrdersDashboardProps {
  businessId: string;
  businessName: string;
  orders: Order[];
}

interface PersistedDashboardState {
  selectedStatus: OrderStatus | "todos";
  isNewOrdersExpanded: boolean;
  expandedGroups: Record<GroupKey, boolean>;
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

function isValidSelectedStatus(value: unknown): value is OrderStatus | "todos" {
  return value === "todos" || isValidOrderStatus(value);
}

function isValidExpandedGroups(value: unknown): value is Record<GroupKey, boolean> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.immediate === "boolean" &&
    typeof candidate.active === "boolean" &&
    typeof candidate.closed === "boolean"
  );
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

function readPersistedDashboardState(
  storageKey: string,
): PersistedDashboardState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedDashboardState>;

    if (
      !isValidSelectedStatus(parsedValue.selectedStatus) ||
      typeof parsedValue.isNewOrdersExpanded !== "boolean" ||
      !isValidExpandedGroups(parsedValue.expandedGroups)
    ) {
      return null;
    }

    return {
      selectedStatus: parsedValue.selectedStatus,
      isNewOrdersExpanded: parsedValue.isNewOrdersExpanded,
      expandedGroups: parsedValue.expandedGroups,
    };
  } catch {
    return null;
  }
}

function getInitialDashboardState(): PersistedDashboardState {
  return {
    selectedStatus: "todos",
    isNewOrdersExpanded: true,
    expandedGroups: defaultExpandedGroupsState,
  };
}

export function OrdersDashboard({
  businessId,
  businessName,
  orders,
}: OrdersDashboardProps) {
  const dashboardStorageKey = getBusinessDashboardStateKey(businessId);
  const [initialDashboardState] = useState(() => getInitialDashboardState());
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [isNewOrdersExpanded, setIsNewOrdersExpanded] = useState(
    initialDashboardState.isNewOrdersExpanded,
  );
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">(
    initialDashboardState.selectedStatus,
  );
  const [expandedGroups, setExpandedGroups] = useState(
    initialDashboardState.expandedGroups,
  );
  const [isNewOrderDrawerOpen, setIsNewOrderDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const persistedOrders = readOrdersForBusiness(businessId);
    const persistedState = readPersistedDashboardState(dashboardStorageKey);

    queueMicrotask(() => {
      if (persistedOrders && persistedOrders.every(isValidOrder)) {
        setOrdersState(
          persistedOrders.filter((order) => order.businessId === businessId),
        );
      } else {
        setOrdersState(orders);
      }

      if (persistedState) {
        setSelectedStatus(persistedState.selectedStatus);
        setIsNewOrdersExpanded(persistedState.isNewOrdersExpanded);
        setExpandedGroups(persistedState.expandedGroups);
      }

      setHasHydrated(true);
    });
  }, [businessId, dashboardStorageKey, orders]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) {
      return;
    }

    const stateToPersist: PersistedDashboardState = {
      selectedStatus,
      isNewOrdersExpanded,
      expandedGroups,
    };

    window.localStorage.setItem(dashboardStorageKey, JSON.stringify(stateToPersist));
  }, [
    dashboardStorageKey,
    expandedGroups,
    hasHydrated,
    isNewOrdersExpanded,
    selectedStatus,
  ]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    writeOrdersForBusiness(businessId, ordersState);
  }, [businessId, hasHydrated, ordersState]);

  const newOrders = ordersState.filter((order) => !order.isReviewed);
  const filteredOrders =
    selectedStatus === "todos"
      ? ordersState
      : ordersState.filter((order) => order.status === selectedStatus);
  const metrics = getDashboardMetrics(ordersState);
  const selectedOrder =
    ordersState.find((order) => order.id === selectedOrderId) ?? null;

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
              "El negocio revisó manualmente este pedido desde el dashboard.",
            ),
          },
    );
  }

  function handleOpenOrderDetails(orderId: string) {
    handleMarkAsReviewed(orderId);
    setSelectedOrderId(orderId);
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
                "El negocio revisó manualmente este pedido desde la bandeja de nuevos.",
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
        "Se preparó un mensaje manual para solicitar el comprobante de pago al cliente.",
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
        `El estado del pago cambió manualmente a ${paymentStatus}.`,
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
          "El pedido pasó manualmente a confirmado después de verificar el pago.",
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
            "Pedido en preparación",
            "El pedido pasó a preparación desde el detalle operativo.",
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
            "El pedido quedó listo para entrega o recogida.",
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
            "El pedido fue marcado como entregado en la operación manual.",
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

  function handleToggleGroup(groupKey: GroupKey) {
    setExpandedGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }));
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
            description: "El pedido fue registrado desde el dashboard operativo.",
            occurredAt: createdAt,
          },
        ],
        observations: input.observations,
      };

      return [newOrder, ...currentOrders];
    });

    setIsNewOrdersExpanded(true);
    setSelectedStatus("todos");
  }

  function handleResetDashboard() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(dashboardStorageKey);
      window.localStorage.removeItem(getBusinessOrdersStorageKey(businessId));
    }

    setOrdersState(orders);
    setSelectedStatus("todos");
    setIsNewOrdersExpanded(true);
    setExpandedGroups(defaultExpandedGroupsState);
    setIsNewOrderDrawerOpen(false);
    setSelectedOrderId(null);
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        businessName={businessName}
        totalOrders={filteredOrders.length}
        newOrdersCount={newOrders.length}
        onOpenNewOrder={() => setIsNewOrderDrawerOpen(true)}
        onResetDashboard={handleResetDashboard}
      />
      <MetricsCards metrics={metrics} />
      {newOrders.length > 0 ? (
        <NewOrdersSection
          orders={newOrders}
          onOpenDetails={handleOpenOrderDetails}
          onMarkAllAsReviewed={handleMarkAllAsReviewed}
          isExpanded={isNewOrdersExpanded}
          onToggleExpanded={() =>
            setIsNewOrdersExpanded((currentValue) => !currentValue)
          }
        />
      ) : (
        <section className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 text-sm text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          Todos los pedidos recientes ya fueron revisados.
        </section>
      )}
      <OrdersFilters
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />
      <OrdersList
        orders={filteredOrders}
        expandedGroups={expandedGroups}
        onToggleGroup={handleToggleGroup}
        onOpenDetails={handleOpenOrderDetails}
      />
      <OrderDetailDrawer
        key={selectedOrder?.id ?? "empty"}
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrderId(null)}
        onRequestPaymentProof={handleRequestPaymentProof}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
        onConfirmOrder={handleConfirmOrder}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onCancelOrder={handleCancelOrder}
      />
      <NewOrderDrawer
        isOpen={isNewOrderDrawerOpen}
        onClose={() => setIsNewOrderDrawerOpen(false)}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
}
