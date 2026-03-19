"use client";

import { useEffect, useState } from "react";

import { MetricsCards } from "@/components/dashboard/metrics-cards";
import {
  defaultExpandedGroupsState,
  OrdersList,
  type GroupKey,
} from "@/components/dashboard/orders-list";
import { OrdersFilters } from "@/components/dashboard/orders-filters";
import { getBusinessDashboardStateKey } from "@/data/order-storage";
import { getOperationalMetrics } from "@/data/orders";
import { getOrderDisplayCode, ORDER_STATUSES, type Order, type OrderStatus } from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

interface OrdersWorkspaceProps {
  businessId: string;
}

interface PersistedOrdersViewState {
  selectedStatus: OrderStatus | "todos";
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

function readPersistedOrdersViewState(storageKey: string): PersistedOrdersViewState | null {
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
      !isValidExpandedGroups(parsedValue.expandedGroups) ||
      typeof parsedValue.searchQuery !== "string"
    ) {
      return null;
    }

    return {
      selectedStatus: parsedValue.selectedStatus,
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
    getOrderDisplayCode(order),
    order.id,
    order.client,
    order.customerPhone ?? "",
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function OrdersWorkspace({ businessId }: OrdersWorkspaceProps) {
  const dashboardStorageKey = getBusinessDashboardStateKey(businessId);
  const [initialOrdersViewState] = useState(() => getInitialOrdersViewState());
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">(
    initialOrdersViewState.selectedStatus,
  );
  const [expandedGroups, setExpandedGroups] = useState(initialOrdersViewState.expandedGroups);
  const [searchQuery, setSearchQuery] = useState(initialOrdersViewState.searchQuery);
  const {
    hasHydrated,
    ordersError,
    ordersState,
    handleResetOrders,
    quickUpdateOrderStatus,
    quickUpdatePaymentStatus,
    openOrderDetails,
  } = useBusinessWorkspace();

  useEffect(() => {
    const persistedState = readPersistedOrdersViewState(dashboardStorageKey);

    if (!persistedState) {
      return;
    }

    queueMicrotask(() => {
      setSelectedStatus(persistedState.selectedStatus);
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
      expandedGroups,
      searchQuery,
    };

    window.localStorage.setItem(dashboardStorageKey, JSON.stringify(stateToPersist));
  }, [dashboardStorageKey, expandedGroups, hasHydrated, searchQuery, selectedStatus]);

  const searchedOrders = ordersState.filter((order) => matchesSearch(order, searchQuery));
  const filteredOrders =
    selectedStatus === "todos"
      ? searchedOrders
      : searchedOrders.filter((order) => order.status === selectedStatus);
  const metrics = getOperationalMetrics(ordersState);
  const hasActiveFilters = selectedStatus !== "todos" || searchQuery.trim().length > 0;

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
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        window.localStorage.removeItem(dashboardStorageKey);
        handleResetOrders();
        setSelectedStatus("todos");
        setSearchQuery("");
        setExpandedGroups(defaultExpandedGroupsState);
      }
    }

    window.addEventListener("keydown", handleDevelopmentReset);

    return () => {
      window.removeEventListener("keydown", handleDevelopmentReset);
    };
  }, [dashboardStorageKey, handleResetOrders]);

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {ordersError ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {ordersError}
        </div>
      ) : null}

      <MetricsCards metrics={metrics} compactOnMobile layout="orders" />

      <OrdersFilters
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultsCount={filteredOrders.length}
      />

      <OrdersList
        orders={filteredOrders}
        hasActiveFilters={hasActiveFilters}
        expandedGroups={expandedGroups}
        onToggleGroup={handleToggleGroup}
        onOpenDetails={openOrderDetails}
        onQuickUpdateOrderStatus={quickUpdateOrderStatus}
        onQuickUpdatePaymentStatus={quickUpdatePaymentStatus}
      />
    </div>
  );
}
