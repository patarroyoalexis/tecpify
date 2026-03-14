"use client";

import { ORDER_STATUSES, type OrderStatus } from "@/types/orders";

interface OrdersFiltersProps {
  selectedStatus: OrderStatus | "todos";
  onStatusChange: (status: OrderStatus | "todos") => void;
}

export function OrdersFilters({
  selectedStatus,
  onStatusChange,
}: OrdersFiltersProps) {
  const filters = ["todos", ...ORDER_STATUSES] as const;

  return (
    <section className="space-y-3 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-950">Filtrar pedidos</h2>
        <p className="text-sm text-slate-600">
          Cambia la vista para priorizar cobros, preparación o entregas.
        </p>
      </div>

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
