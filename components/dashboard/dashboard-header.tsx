interface DashboardHeaderProps {
  businessName: string;
  totalOrders: number;
  newOrdersCount: number;
  title: string;
  description: string;
  primaryActionLabel: string;
  primaryActionHint: string;
  secondaryActionLabel: string;
  secondaryActionHint: string;
  onOpenPrimaryAction: () => void;
  onOpenSecondaryAction: () => void;
}

export function DashboardHeader({
  businessName,
  totalOrders,
  newOrdersCount,
  title,
  description,
  primaryActionLabel,
  primaryActionHint,
  secondaryActionLabel,
  secondaryActionHint,
  onOpenPrimaryAction,
  onOpenSecondaryAction,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between md:p-8">
      <div className="space-y-2">
        <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
          Tecpify
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{businessName}</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
            {description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenPrimaryAction}
          className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-left text-white transition hover:bg-slate-800"
        >
          <p className="text-sm font-medium">{primaryActionLabel}</p>
          <p className="text-xs text-slate-300">{primaryActionHint}</p>
        </button>
        <button
          type="button"
          onClick={onOpenSecondaryAction}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-medium text-slate-700">{secondaryActionLabel}</p>
          <p className="text-xs text-slate-500">{secondaryActionHint}</p>
        </button>
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
