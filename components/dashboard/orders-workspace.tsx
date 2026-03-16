"use client";

import { useEffect, useState } from "react";

import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { GlobalOrderSearch } from "@/components/dashboard/global-order-search";
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
  businessDatabaseId: string | null;
  businessName: string;
  businessSlug: string;
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
  businessDatabaseId,
  businessName,
  businessSlug,
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
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
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
    handleHydrateOrder,
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
  const metrics = getDashboardMetrics(ordersState).map((metric) => {
    if (metric.title === "Pedidos registrados") {
      return { ...metric, title: "Registrados" };
    }

    if (metric.title === "Acciones pendientes") {
      return { ...metric, title: "Pendientes" };
    }

    if (metric.title.includes("En operaci")) {
      return { ...metric, title: "Operacion" };
    }

    if (metric.title === "Ingresos entregados") {
      return { ...metric, title: "Ingresos" };
    }

    return metric;
  });
  const selectedOrder =
    ordersState.find((order) => order.id === selectedOrderId) ?? null;

  function handleOpenOrderDetails(orderId: string) {
    handleMarkAsReviewed(orderId);
    setSelectedOrderId(orderId);
  }

  function handleOpenGlobalSearchResult(order: Order) {
    handleHydrateOrder(order);
    setSelectedOrderId(order.id);
  }

  function handleToggleGroup(groupKey: GroupKey) {
    setExpandedGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }));
  }

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    function handleDevelopmentReset(event: KeyboardEvent) {
      if (
        event.altKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "r"
      ) {
        event.preventDefault();
        window.localStorage.removeItem(dashboardStorageKey);
        handleResetOrders();
        setSelectedStatus("todos");
        setSearchQuery("");
        setIsNewOrdersExpanded(true);
        setExpandedGroups(defaultExpandedGroupsState);
        setIsNewOrderDrawerOpen(false);
        setSelectedOrderId(null);
      }
    }

    window.addEventListener("keydown", handleDevelopmentReset);

    return () => {
      window.removeEventListener("keydown", handleDevelopmentReset);
    };
  }, [dashboardStorageKey, handleResetOrders]);

  return (
    <BusinessWorkspaceShell
      businessName={businessName}
      businessSlug={businessSlug}
      title="Pedidos"
      description="Gestiona la operacion diaria del negocio con una vista pensada para revisar, cobrar, preparar y entregar pedidos."
      headerAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsGlobalSearchOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Buscar pedidos globalmente"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsNewOrderDrawerOpen(true)}
            className="rounded-2xl border border-slate-900 bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Nuevo pedido
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <MetricsCards metrics={metrics} compactOnMobile />

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
      </div>

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

      <GlobalOrderSearch
        businessDatabaseId={businessDatabaseId}
        localOrders={ordersState}
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSelectOrder={handleOpenGlobalSearchResult}
      />
    </BusinessWorkspaceShell>
  );
}
