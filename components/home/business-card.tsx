import Link from "next/link";

interface BusinessCardProps {
  business: {
    businessSlug: string;
    name: string;
    tagline: string;
    accent: string;
  };
  badge: string;
  actions: Array<{
    href: string;
    label: string;
    variant?: "primary" | "secondary";
  }>;
}

export function BusinessCard({
  business,
  badge,
  actions,
}: BusinessCardProps) {
  return (
    <article className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className={`rounded-[24px] bg-gradient-to-r ${business.accent} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
            {business.businessSlug}
          </p>
          <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            {badge}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">{business.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{business.tagline}</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              action.variant === "secondary"
                ? "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                : "rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            }
          >
            {action.label}
          </Link>
        ))}
      </div>
    </article>
  );
}
