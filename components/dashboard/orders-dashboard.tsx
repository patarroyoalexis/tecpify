"use client";

import { useState } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { NewOrdersSection } from "@/components/dashboard/new-orders-section";
import { OrdersFilters } from "@/components/dashboard/orders-filters";
import { OrdersList } from "@/components/dashboard/orders-list";
import { getDashboardMetrics } from "@/data/orders";
import type { Order, OrderStatus } from "@/types/orders";

interface OrdersDashboardProps {
  orders: Order[];
}

export function OrdersDashboard({ orders }: OrdersDashboardProps) {
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [isNewOrdersExpanded, setIsNewOrdersExpanded] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">(
    "todos",
  );

  const newOrders = ordersState.filter((order) => !order.isReviewed);
  const filteredOrders =
    selectedStatus === "todos"
      ? ordersState
      : ordersState.filter((order) => order.status === selectedStatus);
  const metrics = getDashboardMetrics(ordersState);

  function handleMarkAsReviewed(orderId: string) {
    setOrdersState((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId ? { ...order, isReviewed: true } : order,
      ),
    );
  }

  function handleMarkAllAsReviewed() {
    setOrdersState((currentOrders) =>
      currentOrders.map((order) =>
        order.isReviewed ? order : { ...order, isReviewed: true },
      ),
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        totalOrders={filteredOrders.length}
        newOrdersCount={newOrders.length}
      />
      <MetricsCards metrics={metrics} />
      {newOrders.length > 0 ? (
        <NewOrdersSection
          orders={newOrders}
          onMarkAsReviewed={handleMarkAsReviewed}
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
        onMarkAsReviewed={handleMarkAsReviewed}
      />
    </div>
  );
}
