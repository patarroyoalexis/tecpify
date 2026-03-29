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
  compactOnMobile?: boolean;
  layout?: "default" | "orders";
}

function buildMetricToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function MetricsCards({
  metrics,
  compactOnMobile = false,
  layout = "default",
}: MetricsCardsProps) {
  const useOrdersLayout = compactOnMobile && layout === "orders";

  return (
    <section
      data-testid="metrics-cards"
      className={
        useOrdersLayout
          ? "grid w-full grid-cols-2 items-stretch gap-2 md:grid-cols-3 md:gap-3"
          : compactOnMobile
            ? "flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible"
            : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      }
    >
      {metrics.map((metric) => {
        const metricToken = buildMetricToken(metric.title);

        return (
          <article
            key={metric.title}
            data-testid={`metric-card-${metricToken}`}
            className={`rounded-[22px] border shadow-[0_16px_40px_rgba(15,23,42,0.05)] ${
              useOrdersLayout
                ? `min-w-0 px-3 py-2.5 sm:p-3.5 ${
                    metric.title === "Ingresos" ? "col-span-2 md:col-span-1" : ""
                  }`
                : compactOnMobile
                ? "min-w-[132px] px-3 py-2.5 sm:min-w-[148px] md:min-w-0 md:p-3.5"
                : "p-5"
            } ${toneStyles[metric.tone].card}`}
          >
            <p
              data-testid={`metric-card-${metricToken}-title`}
              className={`${compactOnMobile ? "text-[11px] sm:text-xs" : "text-sm"} font-medium ${toneStyles[metric.tone].eyebrow}`}
            >
              {metric.title}
            </p>
            <p
              data-testid={`metric-card-${metricToken}-value`}
              className={`${compactOnMobile ? "mt-1 text-xl leading-none sm:text-2xl md:mt-1.5 md:text-[1.75rem]" : "mt-3 text-3xl"} min-w-0 whitespace-nowrap font-semibold tracking-tight ${toneStyles[metric.tone].value}`}
            >
              {metric.value}
            </p>
            <p
              data-testid={`metric-card-${metricToken}-description`}
              className={`${compactOnMobile ? "hidden md:mt-1.5 md:block md:text-xs md:leading-5" : "mt-2 text-sm leading-6"} text-slate-600`}
            >
              {metric.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}
