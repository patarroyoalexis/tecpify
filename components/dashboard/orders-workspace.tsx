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
import { isProductionRuntime } from "@/lib/runtime";
import { getOrderDisplayCode, ORDER_STATUSES, type Order, type OrderStatus } from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

interface OrdersWorkspaceProps {
  businessSlug: string;
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
    order.orderId,
    order.client,
    order.customerPhone ?? "",
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function OrdersWorkspace({ businessSlug }: OrdersWorkspaceProps) {
  const dashboardStorageKey = getBusinessDashboardStateKey(businessSlug);
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
  const ordersPendingPayment = ordersState.filter(
    (order) => order.paymentStatus !== "verificado" && order.status !== "cancelado",
  ).length;
  const ordersReadyToAdvance = ordersState.filter(
    (order) =>
      order.paymentStatus === "verificado" &&
      !["entregado", "cancelado"].includes(order.status),
  ).length;

  function handleToggleGroup(groupKey: GroupKey) {
    setExpandedGroups((currentState) => ({
      ...currentState,
      [groupKey]: !currentState[groupKey],
    }));
  }

  useEffect(() => {
    if (isProductionRuntime() || typeof window === "undefined") {
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

      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Lectura operativa
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Pedido y pago ahora se leen por separado para detectar mas rapido si falta
              validar cobro o si el pedido ya puede avanzar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              {ordersPendingPayment} con pago pendiente
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              {ordersReadyToAdvance} listos para avanzar
            </span>
          </div>
        </div>
      </section>

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
