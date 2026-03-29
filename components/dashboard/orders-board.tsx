"use client";

import { OrderCard } from "@/components/dashboard/order-card";
import {
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
  getOrderStatusVisuals,
} from "@/lib/orders/status-system";
import { splitOrdersForOperationalBoard } from "@/lib/orders/board-model";
import type { Order } from "@/types/orders";

interface OrdersBoardProps {
  orders: Order[];
  onOpenDetails: (orderId: Order["orderId"]) => void;
  onOpenPaymentReviewModal: (orderId: Order["orderId"]) => void;
  onConfirmOrder: (orderId: Order["orderId"]) => Promise<Order>;
  onAdvanceOrderStatus: (orderId: Order["orderId"]) => Promise<Order | undefined>;
  onOpenCancelOrderModal: (orderId: Order["orderId"]) => void;
  onOpenReactivateOrderModal: (orderId: Order["orderId"]) => void;
}

export function OrdersBoard({
  orders,
  onOpenDetails,
  onOpenPaymentReviewModal,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onOpenCancelOrderModal,
  onOpenReactivateOrderModal,
}: OrdersBoardProps) {
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
              Permanecen fuera del flujo principal, con motivo y reactivación exacta al estado previo.
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
                        : "Sin estado previo válido"}
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
