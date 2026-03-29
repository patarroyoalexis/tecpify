"use client";

import { MetricsCards } from "@/components/dashboard/metrics-cards";
import {
  formatCurrency,
  getOrdersMetricsSummary,
  getMetricsOverviewSnapshot,
} from "@/data/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

function buildMetricsToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function MetricsOverview() {
  const { ordersError, ordersState } = useBusinessWorkspace();
  const snapshot = getMetricsOverviewSnapshot(ordersState);
  const summary = getOrdersMetricsSummary(ordersState);

  return (
    <div data-testid="metrics-overview" className="space-y-6">
      {ordersError ? (
        <section
          data-testid="metrics-orders-error"
          className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {ordersError}
        </section>
      ) : null}

      {ordersState.length === 0 ? (
        <section
          data-testid="metrics-empty-state"
          className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)]"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Metricas iniciales
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Aun no tienes pedidos
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cuando empiecen a entrar pedidos reales, aqui veras solo las señales clave
            para operar y validar el negocio sin depender de analitica compleja.
          </p>
        </section>
      ) : null}

      {snapshot.hasOrders ? (
        <section
          data-testid="metrics-reference-cutoff"
          className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
        >
          Corte actual basado en pedidos persistidos hasta{" "}
          <span className="font-semibold">{snapshot.referenceDateLabel}</span>.
        </section>
      ) : null}

      {summary.pendingFiadoCount > 0 ? (
        <section
          data-testid="metrics-pending-fiado-banner"
          className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Los ingresos efectivos excluyen {summary.pendingFiadoCount} fiado
          {summary.pendingFiadoCount === 1 ? "" : "s"} pendiente
          {summary.pendingFiadoCount === 1 ? "" : "s"} hasta marcarlos como pagados.
        </section>
      ) : null}

      <MetricsCards metrics={snapshot.metrics} />

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Lectura operativa
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Donde enfocarte ahora
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Senales cortas construidas sobre pedidos reales del negocio para priorizar
              cobro, produccion y validacion comercial.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.focusItems.map((item) => {
              const itemToken = buildMetricsToken(item.label);

              return (
                <div
                  key={item.label}
                  data-testid={`metrics-focus-item-${itemToken}`}
                  className={`rounded-[22px] border px-4 py-4 ${
                    item.tone === "warning"
                      ? "border-amber-200 bg-amber-50/70"
                      : item.tone === "success"
                        ? "border-emerald-200 bg-emerald-50/70"
                        : item.tone === "info"
                          ? "border-sky-200 bg-sky-50/70"
                          : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        data-testid={`metrics-focus-item-${itemToken}-label`}
                        className="text-sm font-semibold text-slate-950"
                      >
                        {item.label}
                      </p>
                      <p
                        data-testid={`metrics-focus-item-${itemToken}-description`}
                        className="mt-1 text-sm leading-6 text-slate-600"
                      >
                        {item.description}
                      </p>
                    </div>
                    <span
                      data-testid={`metrics-focus-item-${itemToken}-value`}
                      className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Demanda real
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Lo que mas se esta moviendo
              </h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Lectura simple de productos que mas salen en pedidos no cancelados.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.topProducts.length > 0 ? (
              snapshot.topProducts.map((product, index) => (
                <div
                  key={product.name}
                  data-testid={`metrics-top-product-${index + 1}`}
                  className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <p
                      data-testid={`metrics-top-product-${index + 1}-name`}
                      className="text-sm font-semibold text-slate-950"
                    >
                      {index + 1}. {product.name}
                    </p>
                    <p
                      data-testid={`metrics-top-product-${index + 1}-quantity`}
                      className="text-xs text-slate-500"
                    >
                      {product.quantity} unidad{product.quantity === 1 ? "" : "es"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Top
                  </span>
                </div>
              ))
            ) : (
              <div
                data-testid="metrics-top-products-empty"
                className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600"
              >
                Aun no hay suficiente historial para detectar productos con demanda clara.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">Referencia de valor</p>
            <p
              data-testid="metrics-average-ticket-value"
              className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
            >
              {formatCurrency(summary.averageTicket)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ticket promedio actual sobre pedidos no cancelados que ya cuentan como venta
              efectiva. Sirve para validar si el volumen viene acompanado de buen valor por pedido.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
