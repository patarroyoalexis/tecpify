"use client";

import { useEffect, useState } from "react";

import { OrderCard } from "@/components/dashboard/order-card";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
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

function getCompactMobileStatusLabel(status: Order["status"]) {
  switch (status) {
    case "confirmado":
      return "Conf.";
    case "en preparación":
      return "Prep.";
    case "entregado":
      return "Entreg.";
    default:
      return ORDER_STATUS_LABELS[status];
  }
}

function getMobileTabClassName(status: Order["status"], isActive: boolean) {
  switch (status) {
    case "nuevo":
      return isActive
        ? "border-sky-500 bg-sky-500 text-white shadow-[0_10px_22px_rgba(14,165,233,0.24)]"
        : "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100";
    case "confirmado":
      return isActive
        ? "border-amber-400 bg-amber-400 text-amber-950 shadow-[0_10px_22px_rgba(251,191,36,0.24)]"
        : "border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100";
    case "en preparación":
      return isActive
        ? "border-violet-600 bg-violet-600 text-white shadow-[0_10px_22px_rgba(124,58,237,0.24)]"
        : "border-violet-100 bg-violet-50 text-violet-700 hover:bg-violet-100";
    case "listo":
      return isActive
        ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_10px_22px_rgba(16,185,129,0.22)]"
        : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
    case "entregado":
      return isActive
        ? "border-teal-500 bg-teal-500 text-white shadow-[0_10px_22px_rgba(20,184,166,0.22)]"
        : "border-teal-100 bg-teal-50 text-teal-700 hover:bg-teal-100";
    default:
      return isActive
        ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
  }
}

function getMobileStatusIndicatorClassName(status: Order["status"]) {
  switch (status) {
    case "nuevo":
      return "bg-sky-500";
    case "confirmado":
      return "bg-amber-400";
    case "en preparación":
      return "bg-violet-600";
    case "listo":
      return "bg-emerald-500";
    case "entregado":
      return "bg-teal-500";
    default:
      return "bg-slate-950";
  }
}

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
  const initialStatus = isWorkflowStatus ? defaultMobileStatus : "nuevo";
  const [activeStatus, setActiveStatus] = useState<Order["status"]>(initialStatus);
  const [isCancelledOpen, setIsCancelledOpen] = useState(defaultMobileStatus === "cancelado");
  const activeColumn = columns.find((column) => column.status === activeStatus);
  const activeOrders = activeColumn?.orders ?? [];
  const activeStatusLabel = ORDER_STATUS_LABELS[activeStatus];

  return (
    <div data-testid="orders-mobile-board" className="space-y-3">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200/80 bg-slate-50/80 px-2 pt-2">
          <div
            role="tablist"
            aria-label="Estados operativos de pedidos"
            data-testid="orders-mobile-nav"
            className="grid grid-cols-5 gap-1"
          >
            {columns.map(({ status, orders: columnOrders }) => {
              const isActive = activeStatus === status;

              return (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`orders-mobile-panel-${status}`}
                  aria-label={`${ORDER_STATUS_LABELS[status]} (${columnOrders.length})`}
                  data-testid={`orders-mobile-tab-${status}`}
                  onClick={() => setActiveStatus(status)}
                  className={`flex min-h-[38px] items-center justify-center rounded-t-[14px] border border-b-0 px-1 py-2 text-center text-[11px] font-semibold leading-none transition ${getMobileTabClassName(
                    status,
                    isActive,
                  )}`}
                >
                  <span className="truncate">{getCompactMobileStatusLabel(status)}</span>
                </button>
              );
            })}
          </div>

          <div
            className={`mt-1.5 h-1 rounded-full ${getMobileStatusIndicatorClassName(activeStatus)}`}
          />
        </div>

        <div
          id={`orders-mobile-panel-${activeStatus}`}
          role="tabpanel"
          aria-label={`Pedidos en ${activeStatusLabel}`}
          data-testid={`orders-mobile-panel-${activeStatus}`}
          className="space-y-3 p-3"
        >
          {activeOrders.length > 0 ? (
            activeOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                onOpenDetails={onOpenDetails}
                onOpenPaymentReviewModal={onOpenPaymentReviewModal}
                onConfirmOrder={onConfirmOrder}
                onAdvanceOrderStatus={onAdvanceOrderStatus}
                onOpenCancelOrderModal={onOpenCancelOrderModal}
                onOpenReactivateOrderModal={onOpenReactivateOrderModal}
                variant="mobile"
              />
            ))
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
              No hay pedidos en {activeStatusLabel.toLowerCase()}.
            </div>
          )}
        </div>
      </section>

      <section
        data-testid="orders-mobile-cancelled-section"
        className="overflow-hidden rounded-[22px] border border-rose-300 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.05)]"
      >
        <button
          type="button"
          data-testid="orders-mobile-cancelled-toggle"
          aria-expanded={isCancelledOpen}
          aria-controls="orders-mobile-panel-cancelado"
          onClick={() => setIsCancelledOpen((currentValue) => !currentValue)}
          className="flex w-full items-center justify-between gap-3 bg-[linear-gradient(90deg,#ef4444,#f43f5e)] px-4 py-3 text-left text-white"
        >
          <span className="min-w-0">
            <span className="sr-only">Cancelados aparte</span>
            <span className="block truncate text-sm font-semibold">
              Pedidos cancelados ({cancelledOrders.length})
            </span>
          </span>

          <OrdersUiIcon
            icon={isCancelledOpen ? "chevron-up" : "chevron-down"}
            className="h-4 w-4"
          />
        </button>

        {isCancelledOpen ? (
          <div
            id="orders-mobile-panel-cancelado"
            data-testid="orders-mobile-panel-cancelado"
            className="border-t border-rose-200 bg-rose-50/80 px-3 pb-3 pt-3"
          >
            {cancelledOrders.length > 0 ? (
              <div className="space-y-3">
                {cancelledOrders.map((order) => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    onOpenDetails={onOpenDetails}
                    onOpenPaymentReviewModal={onOpenPaymentReviewModal}
                    onConfirmOrder={onConfirmOrder}
                    onAdvanceOrderStatus={onAdvanceOrderStatus}
                    onOpenCancelOrderModal={onOpenCancelOrderModal}
                    onOpenReactivateOrderModal={onOpenReactivateOrderModal}
                    variant="mobile"
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-rose-200 bg-white/90 px-4 py-5 text-center text-sm text-slate-500">
                No hay pedidos cancelados en este momento.
              </div>
            )}
          </div>
        ) : null}
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
