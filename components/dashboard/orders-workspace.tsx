"use client";

import { useEffect, useMemo, useState } from "react";

import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { OrdersBoard } from "@/components/dashboard/orders-board";
import { OrderPaymentReviewModal } from "@/components/dashboard/order-payment-review-modal";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { getOperationalMetrics } from "@/data/orders";
import { isOrderAwaitingPaymentReview } from "@/lib/orders/payment-gate";
import { isProductionRuntime } from "@/lib/runtime";
import { ORDER_STATUS_LABELS, ORDER_WORKFLOW_STATUSES } from "@/lib/orders/status-system";
import { getOrderDisplayCode, type Order } from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

interface OrdersWorkspaceProps {
  businessSlug: string;
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
    order.cancellationDetail ?? "",
    ...order.products.map((product) => product.name),
  ];

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function OrdersWorkspace({ businessSlug }: OrdersWorkspaceProps) {
  void businessSlug;
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentReviewOrderId, setPaymentReviewOrderId] = useState<Order["orderId"] | null>(
    null,
  );
  const {
    hasHydrated,
    ordersError,
    ordersState,
    handleResetOrders,
    handleAdvanceOrderStatus,
    handleConfirmOrder,
    handleMarkAsReviewed,
    handleUpdatePaymentStatus,
    openCancelOrderModal,
    openOrderDetails,
    openReactivateOrderModal,
  } = useBusinessWorkspace();
  const filteredOrders = useMemo(
    () => ordersState.filter((order) => matchesSearch(order, searchQuery)),
    [ordersState, searchQuery],
  );
  const metrics = getOperationalMetrics(ordersState);
  const pendingPaymentsCount = ordersState.filter(
    (order) => order.status !== "cancelado" && isOrderAwaitingPaymentReview(order),
  ).length;
  const cancelledCount = ordersState.filter((order) => order.status === "cancelado").length;
  const activeCount = ordersState.length - cancelledCount;
  const orderToReview =
    ordersState.find((order) => order.orderId === paymentReviewOrderId) ?? null;

  useEffect(() => {
    if (isProductionRuntime() || typeof window === "undefined") {
      return;
    }

    function handleDevelopmentReset(event: KeyboardEvent) {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleResetOrders();
        setSearchQuery("");
      }
    }

    window.addEventListener("keydown", handleDevelopmentReset);
    return () => window.removeEventListener("keydown", handleDevelopmentReset);
  }, [handleResetOrders]);

  return (
    <div className="w-full space-y-5">
      {ordersError ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {ordersError}
        </div>
      ) : null}

      <MetricsCards metrics={metrics} compactOnMobile layout="orders" />

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Operación de pedidos
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Flujo principal por estado, cancelados por separado
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El board usa el estado operativo real del pedido. El pago vive aparte y solo habilita confirmación o avance cuando corresponde.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Activos
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{activeCount}</p>
            </div>
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Cobros por revisar
              </p>
              <p className="mt-2 text-2xl font-semibold text-amber-950">{pendingPaymentsCount}</p>
            </div>
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                Cancelados
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-950">{cancelledCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex w-full max-w-xl items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
            <OrdersUiIcon icon="search" className="h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por cliente, código, producto o detalle de cancelación"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {ORDER_WORKFLOW_STATUSES.map((status) => (
              <span
                key={status}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {ORDER_STATUS_LABELS[status]}
              </span>
            ))}
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              Cancelado aparte
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
          Desktop queda resuelto como board operativo. En móvil solo dejamos la base semántica y visual lista para reutilizar después con tabs o vistas compactas, sin duplicar reglas ni colores.
        </div>
      </section>

      <OrdersBoard
        orders={filteredOrders}
        onOpenDetails={openOrderDetails}
        onOpenPaymentReviewModal={(orderId) => {
          handleMarkAsReviewed(orderId);
          setPaymentReviewOrderId(orderId);
        }}
        onConfirmOrder={handleConfirmOrder}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onOpenCancelOrderModal={openCancelOrderModal}
        onOpenReactivateOrderModal={openReactivateOrderModal}
      />

      <OrderPaymentReviewModal
        order={orderToReview}
        isOpen={orderToReview !== null}
        onClose={() => setPaymentReviewOrderId(null)}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
      />

      {hasHydrated && filteredOrders.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No encontramos pedidos con ese filtro.
        </section>
      ) : null}
    </div>
  );
}
