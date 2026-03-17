"use client";

import { MetricsCards } from "@/components/dashboard/metrics-cards";
import {
  formatCurrency,
  getAverageTicket,
  getBusinessInsights,
  getDashboardSummary,
  getOrdersRegisteredThisMonth,
  getOrdersRegisteredThisWeek,
  getRevenueSeries,
  getTopProducts,
} from "@/data/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

export function MetricsOverview() {
  const { ordersState } = useBusinessWorkspace();
  const summary = getDashboardSummary(ordersState);
  const topProducts = getTopProducts(ordersState, 5);
  const revenueSeries = getRevenueSeries(ordersState, 5);
  const insights = getBusinessInsights(ordersState);
  const weeklyOrders = getOrdersRegisteredThisWeek(ordersState);
  const monthlyOrders = getOrdersRegisteredThisMonth(ordersState);
  const maxRevenue = revenueSeries.reduce(
    (highestValue, point) => Math.max(highestValue, point.revenue),
    0,
  );

  const metrics = [
    {
      title: "Pedidos registrados esta semana",
      value: `${weeklyOrders.length}`,
      description: "Volumen acumulado en la semana de referencia actual.",
      tone: "neutral" as const,
    },
    {
      title: "Pedidos registrados este mes",
      value: `${monthlyOrders.length}`,
      description: "Volumen acumulado en el mes de referencia actual.",
      tone: "info" as const,
    },
    {
      title: "Ticket promedio",
      value: formatCurrency(getAverageTicket(ordersState)),
      description: "Promedio de valor por pedido activo en el historial actual.",
      tone: "warning" as const,
    },
    {
      title: "Producto más vendido",
      value: summary.featuredProduct?.name ?? "Sin datos",
      description: summary.featuredProduct
        ? `${summary.featuredProduct.quantity} unidades acumuladas.`
        : "Aun no hay suficiente informacion para un top representativo.",
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <MetricsCards metrics={metrics} />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Historico reciente
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Ventas de los ultimos cortes disponibles
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Base inicial lista para crecer en piloto
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {revenueSeries.length > 0 ? (
              revenueSeries.map((point) => {
                const width =
                  maxRevenue > 0 ? Math.max(12, (point.revenue / maxRevenue) * 100) : 12;

                return (
                  <div key={point.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{point.label}</span>
                      <span className="text-slate-500">
                        {point.ordersCount} pedido{point.ordersCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div
                        className="h-3 rounded-full bg-slate-900"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatCurrency(point.revenue)}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Aun no hay suficiente informacion para construir un historico.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Top productos
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Lo que mas se esta moviendo
          </h2>

          <div className="mt-5 space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {index + 1}. {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {product.quantity} unidades
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Top
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Aun no hay productos suficientes para ordenar un ranking.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Insights
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Mensajes automaticos basados en datos reales
          </h2>

          <div className="mt-5 space-y-3">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <div
                  key={insight}
                  className="rounded-[22px] border border-sky-200 bg-sky-50/70 p-4 text-sm leading-6 text-slate-700"
                >
                  {insight}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Aun no hay suficiente informacion para generar insights confiables.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Piloto premium
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Espacio listo para crecer
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Aqui puedes evolucionar hacia comparativos semanales, proyecciones, alertas
            de caida y recomendaciones comerciales sin mezclar esta capa analitica con la
            operacion diaria.
          </p>

          <div className="mt-5 space-y-3 rounded-[22px] border border-white/80 bg-white/80 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Estado del modulo</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                Piloto
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              La estructura ya esta separada para agregar mas analitica sin recargar el
              dashboard ni la vista de pedidos.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
