"use client";

import Link from "next/link";

import { BusinessActivationChecklist } from "@/components/dashboard/business-activation-checklist";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import type { BusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import {
  formatCurrency,
  getBusinessInsights,
  getDashboardSummary,
  getOperationalPriority,
} from "@/data/orders";
import { getOrderDisplayCode } from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

interface DashboardOverviewProps {
  businessSlug: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
}

export function DashboardOverview({
  businessSlug,
  businessName,
  businessReadiness,
}: DashboardOverviewProps) {
  const {
    openNewProduct,
    openProductsManager,
    ordersError,
    ordersState,
  } = useBusinessWorkspace();
  const summary = getDashboardSummary(ordersState);
  const insights = getBusinessInsights(ordersState).slice(0, 2);
  const unreviewedOrders = ordersState.filter((order) => !order.isReviewed);
  const newOrdersToday = unreviewedOrders.filter((order) =>
    summary.recentOrders.some((recentOrder) => recentOrder.id === order.id),
  );
  const urgentOrders = ordersState.filter((order) => getOperationalPriority(order) === "alta");
  const pendingAttention = ordersState.filter(
    (order) =>
      order.status === "pendiente de pago" || order.status === "pago por verificar",
  );
  const hasOrders = ordersState.length > 0;

  const executiveMetrics = [
    {
      title: "Pedidos nuevos",
      value: `${newOrdersToday.length}`,
      description: "Pedidos recientes que entraron al flujo y todavia no se revisan.",
      tone: "info" as const,
    },
    {
      title: "Pedidos sin revisar",
      value: `${unreviewedOrders.length}`,
      description: "Solicitudes pendientes por abrir o revisar manualmente.",
      tone: "warning" as const,
    },
    {
      title: "Actividad urgente",
      value: `${urgentOrders.length}`,
      description: "Pedidos con prioridad alta por tiempo o estado operativo.",
      tone: "warning" as const,
    },
    {
      title: "Pendientes de atencion",
      value: `${pendingAttention.length}`,
      description: "Pedidos que requieren cobro, verificacion o una accion inmediata.",
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {ordersError ? (
        <section className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {ordersError}
        </section>
      ) : null}

      <BusinessActivationChecklist
        businessSlug={businessSlug}
        businessName={businessName}
        businessReadiness={businessReadiness}
        hasOrders={hasOrders}
        onOpenCreateProduct={openNewProduct}
        onOpenProductsManager={openProductsManager}
      />

      {insights.length > 0 ? (
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.9),rgba(255,255,255,0.98))] px-4 py-3.5 shadow-[0_16px_36px_rgba(15,23,42,0.05)] sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <p className="min-w-0 max-w-4xl text-sm font-medium leading-6 text-slate-700 sm:text-[15px]">
              {insights[0]}
            </p>

            <Link
              href={`/metricas/${businessSlug}`}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ver mas metricas
            </Link>
          </div>
        </section>
      ) : null}

      <MetricsCards metrics={executiveMetrics} />

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Actividad reciente
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Pedidos para revisar rapido
              </h2>
            </div>
            <Link
              href={`/pedidos/${businessSlug}`}
              className="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            >
              Ver operacion completa
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {summary.recentOrders.length > 0 ? (
              summary.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-950">{order.client}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {getOrderDisplayCode(order)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.products.length} producto
                        {order.products.length > 1 ? "s" : ""} · {order.status}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-xs text-slate-500">{order.dateLabel}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Aun no hay pedidos recientes para mostrar en este resumen.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Accesos rapidos
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Lo importante en dos toques
          </h2>

          <div className="mt-5 space-y-3">
            <Link
              href={`/pedidos/${businessSlug}`}
              className="block rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <p className="text-base font-semibold text-slate-950">Ir a pedidos</p>
              <p className="mt-1 text-sm text-slate-600">
                Gestiona estados, pagos, prioridad y detalle completo.
              </p>
            </Link>

            <Link
              href={`/metricas/${businessSlug}`}
              className="block rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <p className="text-base font-semibold text-slate-950">Ver metricas</p>
              <p className="mt-1 text-sm text-slate-600">
                Revisa ventas del dia, historico simple y productos destacados.
              </p>
            </Link>

            <button
              type="button"
              onClick={openProductsManager}
              className="block w-full rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-300 hover:bg-slate-100"
            >
              <p className="text-base font-semibold text-slate-950">Gestionar productos</p>
              <p className="mt-1 text-sm text-slate-600">
                Crea, edita, destaca, desactiva y reordena el catalogo del negocio.
              </p>
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-sm font-semibold text-amber-800">Siguiente foco</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {insights[1] ??
                "Cuando tengas mas historial disponible, este espacio mostrara alertas y recomendaciones automaticas."}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
