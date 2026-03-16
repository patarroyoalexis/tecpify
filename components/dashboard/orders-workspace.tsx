"use client";

import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { NewOrdersSection } from "@/components/dashboard/new-orders-section";
import { NewOrderDrawer } from "@/components/dashboard/new-order-drawer";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import {
  defaultExpandedGroupsState,
  OrdersList,
  type GroupKey,
} from "@/components/dashboard/orders-list";
import { OrdersFilters } from "@/components/dashboard/orders-filters";
import { getBusinessDashboardStateKey } from "@/data/order-storage";
import { getDashboardMetrics } from "@/data/orders";
import type { Order, OrderStatus } from "@/types/orders";
import { ORDER_STATUSES } from "@/types/orders";
import { useBusinessOrders } from "./use-business-orders";

interface OrdersWorkspaceProps {
  businessId: string;
  businessName: string;
  orders: Order[];
}

interface PersistedOrdersViewState {
  selectedStatus: OrderStatus | "todos";
  isNewOrdersExpanded: boolean;
  expandedGroups: Record<GroupKey, boolean>;
  searchQuery: string;
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

function readPersistedOrdersViewState(
  storageKey: string,
): PersistedOrdersViewState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedOrdersViewState>;

    if (
      !isValidSelectedStatus(parsedValue.selectedStatus) ||
      typeof parsedValue.isNewOrdersExpanded !== "boolean" ||
      !isValidExpandedGroups(parsedValue.expandedGroups) ||
      typeof parsedValue.searchQuery !== "string"
    ) {
      return null;
    }

    return {
      selectedStatus: parsedValue.selectedStatus,
      isNewOrdersExpanded: parsedValue.isNewOrdersExpanded,
      expandedGroups: parsedValue.expandedGroups,
      searchQuery: parsedValue.searchQuery,
    };
  } catch {
    return null;
  }
}

function getInitialOrdersViewState(): PersistedOrdersViewState {
  return {
    selectedStatus: "todos",
    isNewOrdersExpanded: true,
    expandedGroups: defaultExpandedGroupsState,
    searchQuery: "",
  };
}

function matchesSearch(order: Order, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const searchableValues = [
    order.id,
    order.client,
    order.customerPhone ?? "",
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

export function OrdersWorkspace({
  businessId,
  businessName,
  orders,
}: OrdersWorkspaceProps) {
  const dashboardStorageKey = getBusinessDashboardStateKey(businessId);
  const [initialOrdersViewState] = useState(() => getInitialOrdersViewState());
  const [isNewOrdersExpanded, setIsNewOrdersExpanded] = useState(
    initialOrdersViewState.isNewOrdersExpanded,
  );
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">(
    initialOrdersViewState.selectedStatus,
  );
  const [expandedGroups, setExpandedGroups] = useState(
    initialOrdersViewState.expandedGroups,
  );
  const [searchQuery, setSearchQuery] = useState(
    initialOrdersViewState.searchQuery,
  );
  const [isNewOrderDrawerOpen, setIsNewOrderDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const {
    hasHydrated,
    newOrders,
    ordersState,
    handleAdvanceOrderStatus,
    handleCancelOrder,
    handleConfirmOrder,
    handleCreateOrder,
    handleMarkAllAsReviewed,
    handleMarkAsReviewed,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  } = useBusinessOrders({
    businessId,
    orders,
  });

  useEffect(() => {
    const persistedState = readPersistedOrdersViewState(dashboardStorageKey);

    if (!persistedState) {
      return;
    }

    queueMicrotask(() => {
      setSelectedStatus(persistedState.selectedStatus);
      setIsNewOrdersExpanded(persistedState.isNewOrdersExpanded);
      setExpandedGroups(persistedState.expandedGroups);
      setSearchQuery(persistedState.searchQuery);
    });
  }, [dashboardStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) {
      return;
    }

    const stateToPersist: PersistedOrdersViewState = {
      selectedStatus,
      isNewOrdersExpanded,
      expandedGroups,
      searchQuery,
    };

    window.localStorage.setItem(dashboardStorageKey, JSON.stringify(stateToPersist));
  }, [
    dashboardStorageKey,
    expandedGroups,
    hasHydrated,
    isNewOrdersExpanded,
    searchQuery,
    selectedStatus,
  ]);

  const searchedOrders = ordersState.filter((order) => matchesSearch(order, searchQuery));
  const filteredOrders =
    selectedStatus === "todos"
      ? searchedOrders
      : searchedOrders.filter((order) => order.status === selectedStatus);
  const metrics = getDashboardMetrics(ordersState);
  const selectedOrder =
    ordersState.find((order) => order.id === selectedOrderId) ?? null;

  function handleOpenOrderDetails(orderId: string) {
    handleMarkAsReviewed(orderId);
    setSelectedOrderId(orderId);
  }

  function handleToggleGroup(groupKey: GroupKey) {
    setExpandedGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }));
  }

  function handleResetWorkspace() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(dashboardStorageKey);
    }

    handleResetOrders();
    setSelectedStatus("todos");
    setSearchQuery("");
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
        title="Pedidos"
        description="Centro operativo para revisar cobros, preparar pedidos y cerrar entregas sin salir de la misma vista."
        primaryActionLabel="Nuevo pedido"
        primaryActionHint="Registrar pedido manualmente"
        secondaryActionLabel="Restablecer pedidos"
        secondaryActionHint="Limpia cambios locales y recarga mocks"
        onOpenPrimaryAction={() => setIsNewOrderDrawerOpen(true)}
        onOpenSecondaryAction={handleResetWorkspace}
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultsCount={filteredOrders.length}
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
