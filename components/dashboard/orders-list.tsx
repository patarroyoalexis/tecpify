"use client";

import { OrderCard } from "@/components/dashboard/order-card";
import { getOperationalPriorityScore } from "@/data/orders";
import type { Order, OrderStatus } from "@/types/orders";

interface OrdersListProps {
  orders: Order[];
  expandedGroups: Record<GroupKey, boolean>;
  onToggleGroup: (groupKey: GroupKey) => void;
  onOpenDetails: (orderId: string) => void;
  onMarkAsReviewed?: (orderId: string) => void;
}

export type GroupKey = "immediate" | "active" | "closed";

interface OrderGroup {
  key: GroupKey;
  title: string;
  statuses: OrderStatus[];
  tone: string;
}

const orderGroups: OrderGroup[] = [
  {
    key: "immediate",
    title: "Requieren atención inmediata",
    statuses: ["pendiente de pago", "pago por verificar"],
    tone: "border-amber-200 bg-amber-50/60 text-amber-900",
  },
  {
    key: "active",
    title: "En curso",
    statuses: ["confirmado", "en preparación", "listo"],
    tone: "border-sky-200 bg-sky-50/60 text-sky-900",
  },
  {
    key: "closed",
    title: "Cerrados",
    statuses: ["entregado", "cancelado"],
    tone: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
  },
];

export const defaultExpandedGroupsState: Record<GroupKey, boolean> = {
  immediate: true,
  active: false,
  closed: false,
};

export function OrdersList({
  orders,
  expandedGroups,
  onToggleGroup,
  onOpenDetails,
  onMarkAsReviewed,
}: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-semibold text-slate-950">
          No hay pedidos en este estado
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Prueba con otro filtro para revisar el resto de la operación.
        </p>
      </section>
    );
  }

  const visibleGroups = orderGroups
    .map((group) => ({
      ...group,
      orders: orders
        .filter((order) => group.statuses.includes(order.status))
        .sort(
          (left, right) =>
            getOperationalPriorityScore(right) - getOperationalPriorityScore(left),
        ),
    }))
    .filter((group) => group.orders.length > 0);

  return (
    <section className="space-y-4">
      {visibleGroups.map((group) => {
        const isExpanded = expandedGroups[group.key];

        return (
          <div
            key={group.key}
            className="rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${group.tone}`}
                >
                  {group.title}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {group.orders.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                className="w-fit rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {isExpanded ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {isExpanded ? (
              <div className="mt-4 space-y-4">
                {group.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpenDetails={onOpenDetails}
                    onMarkAsReviewed={onMarkAsReviewed}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {group.orders.length} pedido
                {group.orders.length > 1 ? "s" : ""} en este bloque.
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
