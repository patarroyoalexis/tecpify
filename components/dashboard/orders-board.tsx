"use client";

import { useEffect, useState } from "react";

import { OrderCard } from "@/components/dashboard/order-card";
import { splitOrdersForOperationalBoard } from "@/lib/orders/board-model";
import {
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_WORKFLOW_STATUSES,
  getOrderStatusVisuals,
} from "@/lib/orders/status-system";
import type { Order } from "@/types/orders";

export type OrdersBoardViewport = "desktop" | "mobile";

interface OrdersBoardBaseProps {
  orders: Order[];
  onOpenDetails: (orderId: Order["orderId"]) => void;
  onOpenPaymentReviewModal: (orderId: Order["orderId"]) => void;
  onConfirmOrder: (orderId: Order["orderId"]) => Promise<Order>;
  onAdvanceOrderStatus: (orderId: Order["orderId"]) => Promise<Order | undefined>;
  onOpenCancelOrderModal: (orderId: Order["orderId"]) => void;
  onOpenReactivateOrderModal: (orderId: Order["orderId"]) => void;
  defaultMobileStatus?: Order["status"];
}

interface OrdersBoardProps extends OrdersBoardBaseProps {
  viewport?: OrdersBoardViewport;
}

export interface OrdersBoardViewProps extends OrdersBoardBaseProps {
  viewport: OrdersBoardViewport;
}

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function useOrdersBoardViewport(explicitViewport?: OrdersBoardViewport) {
  const [viewport, setViewport] = useState<OrdersBoardViewport | null>(null);

  useEffect(() => {
    if (explicitViewport) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncViewport = () => {
      setViewport(mediaQuery.matches ? "mobile" : "desktop");
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);

      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, [explicitViewport]);

  return explicitViewport ?? viewport;
}

function OrdersDesktopBoard({
  orders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
}: OrdersBoardBaseProps) {
  const { cancelledOrders, columns } = splitOrdersForOperationalBoard(orders);

  return (
    <div className="space-y-5">
      <section
        data-testid="orders-board-main"
        className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]"
      >
        <div className="flex min-w-[1380px] gap-4">
          {columns.map(({ status, orders: columnOrders }) => {
            const visuals = getOrderStatusVisuals(status);

            return (
              <section
                key={status}
                data-testid={`order-board-column-${status}`}
                className="flex min-h-[520px] w-[264px] flex-col rounded-[24px] border border-slate-200 bg-slate-50/60"
              >
                <header
                  data-testid={`order-board-column-header-${status}`}
                  className={`rounded-t-[24px] border-b px-4 py-4 ${visuals.boardHeaderClassName}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${visuals.dotClassName}`} />
                      <h2 className="text-sm font-semibold">{ORDER_STATUS_LABELS[status]}</h2>
                    </div>
                    <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-current/10 bg-white/70 px-2 py-1 text-xs font-semibold">
                      {columnOrders.length}
                    </span>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {columnOrders.length > 0 ? (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.orderId}
                        order={order}
                        onOpenDetails={onOpenDetails}
                        onOpenPaymentReviewModal={onOpenPaymentReviewModal}
                        onConfirmOrder={onConfirmOrder}
                        onAdvanceOrderStatus={onAdvanceOrderStatus}
                        onOpenCancelOrderModal={onOpenCancelOrderModal}
                        onOpenReactivateOrderModal={onOpenReactivateOrderModal}
                      />
                    ))
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
                      No hay pedidos en {ORDER_STATUS_LABELS[status].toLowerCase()}.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section
        data-testid="orders-board-cancelled"
        className="rounded-[28px] border border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,255,255,0.98))] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]"
      >
        <header className="flex flex-col gap-2 border-b border-rose-200/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
              Salida excepcional
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Pedidos cancelados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Permanecen fuera del flujo principal, con motivo y reactivacion exacta al estado
              previo.
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700">
            {cancelledOrders.length} cancelado{cancelledOrders.length === 1 ? "" : "s"}
          </span>
        </header>

        {cancelledOrders.length > 0 ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {cancelledOrders.map((order) => (
              <div
                key={order.orderId}
                className="rounded-[24px] border border-rose-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-950">{order.client}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {ORDER_STATUS_LABELS.cancelado}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Motivo:{" "}
                      {order.cancellationReason
                        ? ORDER_CANCELLATION_REASON_LABELS[order.cancellationReason]
                        : "Sin motivo registrado"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Vuelve a:{" "}
                      {order.previousStatusBeforeCancellation
                        ? ORDER_STATUS_LABELS[order.previousStatusBeforeCancellation]
                        : "Sin estado previo valido"}
                    </p>
                    {order.cancellationDetail ? (
                      <p className="mt-2 text-sm text-slate-700">{order.cancellationDetail}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(order.orderId)}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenReactivateOrderModal(order.orderId)}
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                    >
                      Reactivar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-rose-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-500">
            No hay pedidos cancelados en este momento.
          </div>
        )}
      </section>
    </div>
  );
}

function OrdersMobileBoard({
  orders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
  defaultMobileStatus = "nuevo",
}: OrdersBoardBaseProps) {
  const { cancelledOrders, columns } = splitOrdersForOperationalBoard(orders);
  const isWorkflowStatus = ORDER_WORKFLOW_STATUSES.some((status) => status === defaultMobileStatus);
  const initialStatus =
    defaultMobileStatus === "cancelado" || isWorkflowStatus ? defaultMobileStatus : "nuevo";
  const [activeStatus, setActiveStatus] = useState<Order["status"]>(initialStatus);
  const activeColumn = columns.find((column) => column.status === activeStatus);
  const activeOrders = activeStatus === "cancelado" ? cancelledOrders : activeColumn?.orders ?? [];
  const activeStatusLabel = ORDER_STATUS_LABELS[activeStatus];
  const activeVisuals = getOrderStatusVisuals(activeStatus);
  const isCancelledView = activeStatus === "cancelado";

  return (
    <div data-testid="orders-mobile-board" className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Operacion movil
          </p>
          <h2 className="text-xl font-semibold text-slate-950">
            Tabs por estado y lista vertical
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Nuevo sigue siendo la compuerta principal. Cancelado queda fuera del flujo operativo.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Estados operativos de pedidos"
          data-testid="orders-mobile-nav"
          className="mt-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {columns.map(({ status, orders: columnOrders }) => {
              const visuals = getOrderStatusVisuals(status);
              const isActive = activeStatus === status;

              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`orders-mobile-panel-${status}`}
                  data-testid={`orders-mobile-tab-${status}`}
                  onClick={() => setActiveStatus(status)}
                  className={`rounded-[22px] border px-3 py-3 text-left transition ${
                    status === "entregado" ? "col-span-2" : ""
                  } ${
                    isActive
                      ? visuals.badgeClassName
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{ORDER_STATUS_LABELS[status]}</span>
                    <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-current/10 bg-white/80 px-2 py-1 text-xs font-semibold">
                      {columnOrders.length}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs opacity-80">
                    {status === "nuevo"
                      ? "Compuerta operativa principal."
                      : `Pedidos en ${ORDER_STATUS_LABELS[status].toLowerCase()}.`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-rose-200/80 pt-3">
            <button
              type="button"
              role="tab"
              aria-selected={isCancelledView}
              aria-controls="orders-mobile-panel-cancelado"
              data-testid="orders-mobile-tab-cancelado"
              onClick={() => setActiveStatus("cancelado")}
              className={`flex w-full items-center justify-between gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                isCancelledView
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-rose-200/80 bg-rose-50/50 text-rose-700 hover:border-rose-300 hover:bg-rose-100/70"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{ORDER_STATUS_LABELS.cancelado}</span>
                <span className="mt-1 block text-xs opacity-80">
                  Vista secundaria fuera del flujo principal.
                </span>
              </span>
              <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-current/10 bg-white/85 px-2 py-1 text-xs font-semibold">
                {cancelledOrders.length}
              </span>
            </button>
          </div>
        </div>
      </section>

      <section
        id={`orders-mobile-panel-${activeStatus}`}
        role="tabpanel"
        aria-label={`Pedidos en ${activeStatusLabel}`}
        data-testid={`orders-mobile-panel-${activeStatus}`}
        className={`rounded-[28px] border p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)] ${
          isCancelledView
            ? "border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,255,255,0.98))]"
            : "border-slate-200 bg-white"
        }`}
      >
        <header
          className={`rounded-[22px] border px-4 py-4 ${
            isCancelledView
              ? "border-rose-200 bg-white/70 text-slate-900"
              : `${activeVisuals.boardHeaderClassName} bg-white/80`
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/70">
                {isCancelledView ? "Salida excepcional" : "Estado activo"}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{activeStatusLabel}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {isCancelledView
                  ? "Se gestionan aparte para no contaminar la operacion diaria."
                  : activeStatus === "nuevo"
                    ? "La operacion se destraba aqui antes de confirmar o avanzar."
                    : `Lista vertical para operar pedidos en ${activeStatusLabel.toLowerCase()}.`}
              </p>
            </div>

            <span className="inline-flex min-w-9 items-center justify-center rounded-full border border-current/10 bg-white/85 px-2.5 py-1 text-xs font-semibold">
              {activeOrders.length}
            </span>
          </div>
        </header>

        {activeOrders.length > 0 ? (
          <div className="mt-4 space-y-3">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                onOpenDetails={onOpenDetails}
                onOpenPaymentReviewModal={onOpenPaymentReviewModal}
                onConfirmOrder={onConfirmOrder}
                onAdvanceOrderStatus={onAdvanceOrderStatus}
                onOpenCancelOrderModal={onOpenCancelOrderModal}
                onOpenReactivateOrderModal={onOpenReactivateOrderModal}
              />
            ))}
          </div>
        ) : (
          <div
            className={`mt-4 rounded-[22px] border border-dashed px-4 py-8 text-center text-sm ${
              isCancelledView
                ? "border-rose-200 bg-white/70 text-slate-500"
                : "border-slate-200 bg-slate-50/70 text-slate-500"
            }`}
          >
            {isCancelledView
              ? "No hay pedidos cancelados en este momento."
              : `No hay pedidos en ${activeStatusLabel.toLowerCase()}.`}
          </div>
        )}
      </section>
    </div>
  );
}

export function OrdersBoardView({ viewport, ...props }: OrdersBoardViewProps) {
  if (viewport === "mobile") {
    return <OrdersMobileBoard {...props} />;
  }

  return <OrdersDesktopBoard {...props} />;
}

export function OrdersBoard({ viewport: explicitViewport, ...props }: OrdersBoardProps) {
  const viewport = useOrdersBoardViewport(explicitViewport);

  if (!viewport) {
    return (
      <section
        data-testid="orders-board-loading"
        className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]"
      >
        <div className="space-y-3">
          <div className="h-5 w-40 rounded-full bg-slate-100" />
          <div className="h-24 rounded-[24px] bg-slate-50" />
          <div className="h-24 rounded-[24px] bg-slate-50" />
        </div>
      </section>
    );
  }

  return <OrdersBoardView viewport={viewport} {...props} />;
}
