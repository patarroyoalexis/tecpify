import type { MetricCard, MetricTone } from "@/types/orders";

const toneStyles: Record<
  MetricTone,
  { card: string; eyebrow: string; value: string }
> = {
  neutral: {
    card: "border-slate-200/80 bg-white",
    eyebrow: "text-slate-500",
    value: "text-slate-950",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/80",
    eyebrow: "text-amber-700",
    value: "text-amber-950",
  },
  info: {
    card: "border-sky-200 bg-sky-50/80",
    eyebrow: "text-sky-700",
    value: "text-sky-950",
  },
  success: {
    card: "border-emerald-200 bg-emerald-50/80",
    eyebrow: "text-emerald-700",
    value: "text-emerald-950",
  },
};

interface MetricsCardsProps {
  metrics: MetricCard[];
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article
          key={metric.title}
          className={`rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] ${toneStyles[metric.tone].card}`}
        >
          <p className={`text-sm font-medium ${toneStyles[metric.tone].eyebrow}`}>
            {metric.title}
          </p>
          <p
            className={`mt-3 text-3xl font-semibold tracking-tight ${toneStyles[metric.tone].value}`}
          >
            {metric.value}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {metric.description}
          </p>
        </article>
      ))}
    </section>
  );
}
