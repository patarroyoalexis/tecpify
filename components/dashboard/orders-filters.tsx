"use client";

import { useState } from "react";

import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { ORDER_STATUSES, type OrderStatus } from "@/types/orders";

interface OrdersFiltersProps {
  selectedStatus: OrderStatus | "todos";
  onStatusChange: (status: OrderStatus | "todos") => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  resultsCount?: number;
}

const primaryStatuses: Array<OrderStatus | "todos"> = [
  "todos",
  "pendiente de pago",
  "pago por verificar",
  "en preparación",
  "listo",
];

const secondaryStatuses = ORDER_STATUSES.filter(
  (status) => !primaryStatuses.includes(status),
);

function getStatusLabel(status: OrderStatus | "todos") {
  if (status === "todos") {
    return "Todos";
  }

  return status;
}

export function OrdersFilters({
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  resultsCount,
}: OrdersFiltersProps) {
  const [showSecondaryStatuses, setShowSecondaryStatuses] = useState(false);

  return (
    <section className="sticky top-3 z-20 -mx-1 rounded-[22px] border border-white/70 bg-white/92 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:rounded-[24px] sm:p-4">
      {typeof searchQuery === "string" && onSearchChange ? (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-slate-400 focus-within:bg-white">
            <OrdersUiIcon icon="search" className="h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar cliente, pedido, telefono o producto"
              aria-label="Buscar pedidos"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-base leading-6 text-slate-900 outline-none sm:text-sm sm:leading-5"
            />
          </div>
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            {resultsCount ?? 0}
          </div>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {primaryStatuses.map((status) => {
          const isActive = selectedStatus === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition sm:px-3.5 sm:text-sm ${
                isActive
                  ? "bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {getStatusLabel(status)}
            </button>
          );
        })}

        {secondaryStatuses.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowSecondaryStatuses((currentValue) => !currentValue)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:px-3.5 sm:text-sm ${
              showSecondaryStatuses
                ? "bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={showSecondaryStatuses ? "Ocultar más filtros" : "Mostrar más filtros"}
          >
            <OrdersUiIcon icon="filter" className="h-3.5 w-3.5" />
            Más
          </button>
        ) : null}
      </div>

      {showSecondaryStatuses ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2.5">
          {secondaryStatuses.map((status) => {
            const isActive = selectedStatus === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition sm:px-3.5 sm:text-sm ${
                  isActive
                    ? "bg-slate-900 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
