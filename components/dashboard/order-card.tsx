import { formatCurrency } from "@/data/orders";
import type { Order, OrderStatus } from "@/types/orders";

const statusStyles: Record<OrderStatus, string> = {
  "pendiente de pago": "border border-amber-200 bg-amber-50 text-amber-800",
  "pago por verificar": "border border-sky-200 bg-sky-50 text-sky-800",
  confirmado: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  "en preparación": "border border-orange-200 bg-orange-50 text-orange-800",
  listo: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  entregado: "border border-green-200 bg-green-50 text-green-800",
  cancelado: "border border-rose-200 bg-rose-50 text-rose-800",
};

interface OrderCardProps {
  order: Order;
  onMarkAsReviewed?: (orderId: string) => void;
  compact?: boolean;
}

export function OrderCard({
  order,
  onMarkAsReviewed,
  compact = false,
}: OrderCardProps) {
  return (
    <article
      className={`rounded-[24px] border bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(15,23,42,0.08)] ${
        order.isReviewed
          ? "border-slate-200/80"
          : "border-rose-200 bg-rose-50/30"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-950">{order.client}</h3>
            {!order.isReviewed ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Nuevo
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600">
              {order.id}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status]}`}
            >
              {order.status}
            </span>
          </div>

          <ul className="space-y-1 text-sm text-slate-600">
            {order.products.map((product) => (
              <li key={`${order.id}-${product.name}`}>
                {product.quantity} x {product.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3 lg:min-w-[360px]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Total
            </p>
            <p className="mt-1 text-base font-semibold text-slate-950">
              {formatCurrency(order.total)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Pago
            </p>
            <p className="mt-1 text-base font-medium text-slate-900">
              {order.paymentMethod}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Fecha
            </p>
            <p className="mt-1 text-base font-medium text-slate-900">
              {order.dateLabel}
            </p>
          </div>
        </div>
      </div>

      {!order.isReviewed && onMarkAsReviewed ? (
        <div className={`${compact ? "mt-4" : "mt-5"} flex justify-end`}>
          <button
            type="button"
            onClick={() => onMarkAsReviewed(order.id)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Marcar como revisado
          </button>
        </div>
      ) : null}

      {order.observations ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Observaciones:</span>{" "}
          {order.observations}
        </div>
      ) : null}
    </article>
  );
}
