interface DashboardHeaderProps {
  totalOrders: number;
  newOrdersCount: number;
}

export function DashboardHeader({
  totalOrders,
  newOrdersCount,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between md:p-8">
      <div className="space-y-2">
        <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
          Tecpify
        </span>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Dashboard de pedidos
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
            Seguimiento claro del estado de cada pedido para pequeños negocios,
            con foco en cobros, preparación y entregas.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">Pedidos visibles</p>
          <p className="text-2xl font-semibold text-slate-950">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm text-rose-700">Pedidos nuevos</p>
          <p className="text-2xl font-semibold text-rose-950">{newOrdersCount}</p>
        </div>
      </div>
    </header>
  );
}
