import { OrderCard } from "@/components/dashboard/order-card";
import type { Order } from "@/types/orders";

interface NewOrdersSectionProps {
  orders: Order[];
  onOpenDetails: (orderId: string) => void;
  onMarkAllAsReviewed: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function NewOrdersSection({
  orders,
  onOpenDetails,
  onMarkAllAsReviewed,
  isExpanded,
  onToggleExpanded,
}: NewOrdersSectionProps) {
  return (
    <section className="space-y-4 rounded-[28px] border border-rose-200 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Pedidos nuevos
          </div>
          <h2 className="text-xl font-semibold text-slate-950">
            Pendientes por abrir
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Abre cada pedido para revisarlo. Al verlo, dejara de aparecer en esta lista.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isExpanded && orders.length > 1 ? (
            <button
              type="button"
              onClick={onMarkAllAsReviewed}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Marcar todos como revisados
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            {isExpanded ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpenDetails={onOpenDetails}
              compact
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-rose-800">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            {`Pedidos nuevos (${orders.length})`}
          </div>
          <p className="text-sm text-slate-600">
            Seccion contraida. Toca en <strong>Mostrar</strong> para abrir los pedidos pendientes.
          </p>
        </div>
      )}
    </section>
  );
}
