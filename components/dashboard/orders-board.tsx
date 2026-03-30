"use client";

import { useEffect, useState } from "react";

import { OrderCard } from "@/components/dashboard/order-card";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { splitOrdersForOperationalBoard } from "@/lib/orders/board-model";
import {
  ORDER_STATUS_LABELS,
  ORDER_WORKFLOW_STATUSES,
  getOrderStatusVisuals,
} from "@/lib/orders/status-system";
import type { Order } from "@/types/orders";

export type OrdersBoardViewport = "desktop" | "tablet" | "mobile";

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

interface OrdersBoardColumnProps extends OrdersBoardBaseProps {
  status: Order["status"];
  columnOrders: Order[];
  density: "board" | "stacked";
}

interface OrdersCancelledRailProps extends OrdersBoardBaseProps {
  cancelledOrders: Order[];
}

interface OrdersGridBoardProps extends OrdersBoardBaseProps {
  density: "board" | "stacked";
  gridClassName: string;
}

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const TABLET_VERTICAL_MEDIA_QUERY =
  "(min-width: 768px) and (max-width: 1023px) and (orientation: portrait)";

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
        ? "border-orange-500 bg-orange-500 text-white shadow-[0_10px_22px_rgba(249,115,22,0.24)]"
        : "border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100";
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
      return "bg-orange-500";
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

    const mobileMediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const tabletVerticalMediaQuery = window.matchMedia(TABLET_VERTICAL_MEDIA_QUERY);

    const syncViewport = () => {
      if (mobileMediaQuery.matches) {
        setViewport("mobile");
        return;
      }

      if (tabletVerticalMediaQuery.matches) {
        setViewport("tablet");
        return;
      }

      setViewport("desktop");
    };

    syncViewport();

    const addListener = (mediaQuery: MediaQueryList) => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncViewport);
        return () => mediaQuery.removeEventListener("change", syncViewport);
      }

      mediaQuery.addListener(syncViewport);
      return () => mediaQuery.removeListener(syncViewport);
    };

    const removeMobileListener = addListener(mobileMediaQuery);
    const removeTabletListener = addListener(tabletVerticalMediaQuery);

    return () => {
      removeMobileListener();
      removeTabletListener();
    };
  }, [explicitViewport]);

  return explicitViewport ?? viewport;
}

function OrdersBoardColumn({
  status,
  columnOrders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
  density,
}: OrdersBoardColumnProps) {
  const visuals = getOrderStatusVisuals(status);
  const isStacked = density === "stacked";

  return (
    <section
      key={status}
      data-testid={`order-board-column-${status}`}
      className={`flex min-h-0 flex-col overflow-hidden rounded-[26px] border shadow-[0_18px_36px_rgba(15,23,42,0.08)] ${visuals.boardSurfaceClassName}`}
    >
      <header
        data-testid={`order-board-column-header-${status}`}
        className={`border-b px-4 py-4 ${visuals.boardHeaderClassName}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${visuals.dotClassName}`} />
            <h2 className={`truncate font-semibold ${isStacked ? "text-[15px]" : "text-sm"}`}>
              {ORDER_STATUS_LABELS[status]}
            </h2>
          </div>

          <span className="inline-flex min-w-9 items-center justify-center rounded-full border border-current/10 bg-white/75 px-2.5 py-1 text-xs font-semibold text-current shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            {columnOrders.length}
          </span>
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 ${isStacked ? "pr-2.5" : "pr-3"}`}>
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
          <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white/72 px-4 py-8 text-center text-sm text-slate-500">
            No hay pedidos en {ORDER_STATUS_LABELS[status].toLowerCase()}.
          </div>
        )}
      </div>
    </section>
  );
}

function OrdersCancelledRail({
  cancelledOrders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
}: OrdersCancelledRailProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Cerrar bandeja de cancelados"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 hidden bg-slate-950/14 backdrop-blur-[2px] md:block"
        />
      ) : null}

      <section
        data-testid="orders-board-cancelled"
        className={`fixed inset-x-3 bottom-0 z-40 hidden h-[70dvh] min-h-[4.5rem] max-h-[70dvh] overflow-hidden rounded-t-[30px] border border-rose-300/80 bg-[linear-gradient(180deg,rgba(220,38,38,0.98)_0%,rgba(239,68,68,0.98)_12%,rgba(255,241,242,0.98)_34%,rgba(255,255,255,1)_100%)] shadow-[0_-26px_64px_rgba(127,29,29,0.24)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block sm:inset-x-4 lg:inset-x-5 ${
          isOpen ? "translate-y-0" : "translate-y-[calc(100%-4.5rem)]"
        }`}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="orders-board-cancelled-panel"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          className="flex h-[4.5rem] w-full items-center justify-between gap-4 border-b border-white/18 bg-[linear-gradient(90deg,rgba(185,28,28,0.96)_0%,rgba(239,68,68,0.96)_100%)] px-4 text-left text-white sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100/90">
              Cancelados aparte
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold">
                Pedidos cancelados
              </span>
              <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-white/16 bg-white/14 px-2.5 py-1 text-xs font-semibold">
                {cancelledOrders.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-rose-50/90 lg:inline">
              {isOpen ? "Cerrar bandeja" : "Abrir bandeja"}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/16 bg-white/10">
              <OrdersUiIcon
                icon={isOpen ? "chevron-down" : "chevron-up"}
                className="h-4 w-4"
              />
            </span>
          </div>
        </button>

        <div
          id="orders-board-cancelled-panel"
          className="h-[calc(70dvh-4.5rem)] overflow-y-auto px-4 pb-5 pt-4 sm:px-5"
        >
          {cancelledOrders.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-rose-300 bg-white/78 px-4 text-center text-sm text-slate-600">
              No hay pedidos cancelados en este momento.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function OrdersGridBoard({
  orders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
  density,
  gridClassName,
}: OrdersGridBoardProps) {
  const { cancelledOrders, columns } = splitOrdersForOperationalBoard(orders);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-20">
      <section
        data-testid="orders-board-main"
        className="min-h-0 flex-1 overflow-hidden rounded-[32px] border border-workspace-border/90 bg-[linear-gradient(180deg,rgb(var(--workspace-panel-strong-rgb)/0.94)_0%,rgb(var(--workspace-panel-rgb)/0.92)_100%)] p-3 shadow-[0_24px_56px_rgba(15,23,42,0.12)] lg:p-4"
      >
        <div
          className={`grid h-full min-h-0 auto-rows-[minmax(0,1fr)] gap-3 ${gridClassName}`}
        >
          {columns.map(({ status, orders: columnOrders }) => (
            <OrdersBoardColumn
              key={status}
              status={status}
              columnOrders={columnOrders}
              density={density}
              onOpenDetails={onOpenDetails}
              onOpenPaymentReviewModal={onOpenPaymentReviewModal}
              onConfirmOrder={onConfirmOrder}
              onAdvanceOrderStatus={onAdvanceOrderStatus}
              onOpenCancelOrderModal={onOpenCancelOrderModal}
              onOpenReactivateOrderModal={onOpenReactivateOrderModal}
              orders={orders}
            />
          ))}
        </div>
      </section>

      <OrdersCancelledRail
        cancelledOrders={cancelledOrders}
        orders={orders}
        onOpenDetails={onOpenDetails}
        onOpenPaymentReviewModal={onOpenPaymentReviewModal}
        onConfirmOrder={onConfirmOrder}
        onAdvanceOrderStatus={onAdvanceOrderStatus}
        onOpenCancelOrderModal={onOpenCancelOrderModal}
        onOpenReactivateOrderModal={onOpenReactivateOrderModal}
      />
    </div>
  );
}

function OrdersDesktopBoard(props: OrdersBoardBaseProps) {
  return <OrdersGridBoard {...props} density="board" gridClassName="grid-cols-5" />;
}

function OrdersTabletBoard(props: OrdersBoardBaseProps) {
  return (
    <OrdersGridBoard
      {...props}
      density="stacked"
      gridClassName="grid-cols-2 min-[920px]:grid-cols-3"
    />
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
    <div data-testid="orders-mobile-board" className="space-y-3 pb-20">
      <section className="overflow-hidden rounded-[26px] border border-workspace-border/90 bg-white/96 shadow-[0_20px_42px_rgba(15,23,42,0.1)]">
        <div className="border-b border-workspace-border/80 bg-[linear-gradient(180deg,rgb(var(--workspace-panel-rgb))_0%,rgb(var(--workspace-shell-rgb)/0.82)_100%)] px-2 pt-2">
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
        className="overflow-hidden rounded-[22px] border border-rose-300 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
      >
        <button
          type="button"
          data-testid="orders-mobile-cancelled-toggle"
          aria-expanded={isCancelledOpen}
          aria-controls="orders-mobile-panel-cancelado"
          onClick={() => setIsCancelledOpen((currentValue) => !currentValue)}
          className="flex w-full items-center justify-between gap-3 bg-[linear-gradient(90deg,#dc2626,#fb7185)] px-4 py-3 text-left text-white"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100/90">
              Cancelados aparte
            </span>
            <span className="mt-1 block truncate text-sm font-semibold">
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

  if (viewport === "tablet") {
    return <OrdersTabletBoard {...props} />;
  }

  return <OrdersDesktopBoard {...props} />;
}

export function OrdersBoard({ viewport: explicitViewport, ...props }: OrdersBoardProps) {
  const viewport = useOrdersBoardViewport(explicitViewport);

  if (!viewport) {
    return (
      <section
        data-testid="orders-board-loading"
        className="rounded-[30px] border border-workspace-border bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
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
