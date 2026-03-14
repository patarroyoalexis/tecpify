"use client";

import { useState } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { NewOrdersSection } from "@/components/dashboard/new-orders-section";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import { OrdersFilters } from "@/components/dashboard/orders-filters";
import { OrdersList } from "@/components/dashboard/orders-list";
import { getDashboardMetrics } from "@/data/orders";
import type {
  Order,
  OrderHistoryEvent,
  OrderStatus,
  PaymentStatus,
} from "@/types/orders";

interface OrdersDashboardProps {
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

export function OrdersDashboard({ orders }: OrdersDashboardProps) {
  const [ordersState, setOrdersState] = useState<Order[]>(orders);
  const [isNewOrdersExpanded, setIsNewOrdersExpanded] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "todos">(
    "todos",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
          onOpenDetails={setSelectedOrderId}
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
        onOpenDetails={setSelectedOrderId}
        onMarkAsReviewed={handleMarkAsReviewed}
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
    </div>
  );
}
