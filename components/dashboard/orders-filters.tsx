"use client";

import { ORDER_STATUSES, type OrderStatus } from "@/types/orders";

interface OrdersFiltersProps {
  selectedStatus: OrderStatus | "todos";
  onStatusChange: (status: OrderStatus | "todos") => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  resultsCount?: number;
}

export function OrdersFilters({
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  resultsCount,
}: OrdersFiltersProps) {
  const filters = ["todos", ...ORDER_STATUSES] as const;

  return (
    <section className="space-y-3 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-950 sm:text-lg">Filtrar pedidos</h2>
        <p className="hidden text-sm text-slate-600 sm:block">
          Cambia la vista para priorizar cobros, preparacion o entregas.
        </p>
      </div>

      {typeof searchQuery === "string" && onSearchChange ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Buscar</span>
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Cliente, pedido, telefono o producto"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {resultsCount ?? 0} resultado{resultsCount === 1 ? "" : "s"}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filters.map((status) => {
          const isActive = selectedStatus === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
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
    </section>
  );
}
