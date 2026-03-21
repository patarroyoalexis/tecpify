"use client";

import Link from "next/link";

import { BusinessActivationChecklist } from "@/components/dashboard/business-activation-checklist";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import type { BusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import {
  formatCurrency,
  getBusinessInsights,
  getOrdersMetricsSummary,
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
  const metricsSummary = getOrdersMetricsSummary(ordersState);
  const summary = getDashboardSummary(ordersState);
  const insights = getBusinessInsights(ordersState).slice(0, 2);
  const unreviewedOrders = ordersState.filter((order) => !order.isReviewed);
  const newOrdersToday = unreviewedOrders.filter((order) =>
    summary.recentOrders.some((recentOrder) => recentOrder.id === order.id),
  );
  const urgentOrders = ordersState.filter((order) => getOperationalPriority(order) === "alta");
  const hasOrders = ordersState.length > 0;
  const nextRecommendedAction = !hasOrders && businessReadiness.totalProducts === 0
    ? {
        title: "Crear primer producto",
        description: "Es el paso que destraba el link publico y acerca al primer pedido real.",
        actionLabel: "Abrir creacion de producto",
        onClick: openNewProduct,
      }
    : !hasOrders && businessReadiness.activeProducts === 0
      ? {
          title: "Activar catalogo",
          description: "Ya existe catalogo base. Falta dejar al menos un producto visible para vender.",
          actionLabel: "Abrir gestion de productos",
          onClick: openProductsManager,
        }
      : !hasOrders
        ? {
            title: "Provocar el primer pedido real",
            description: "El negocio ya puede vender. Ahora conviene abrir el formulario publico y hacer una prueba corta.",
            actionLabel: "Abrir formulario publico",
            href: `/pedido/${businessSlug}`,
          }
        : {
            title: "Entrar a operacion diaria",
            description: "Ya llego el primer pedido. Desde aqui conviene priorizar seguimiento, pagos y estados.",
            actionLabel: "Ir a pedidos",
            href: `/pedidos/${businessSlug}`,
          };

  const executiveMetrics = [
    {
      title: "Pedidos nuevos",
      value: `${newOrdersToday.length}`,
      description: "Pedidos recientes que entraron al flujo y todavia no se revisan.",
      tone: "info" as const,
    },
    {
      title: "Pedidos sin revisar",
      value: `${metricsSummary.unreviewedCount}`,
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
      value: `${metricsSummary.pendingActionsCount}`,
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

            <div className="flex flex-wrap items-center gap-3">
              {metricsSummary.hasOrders ? (
                <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                  Corte actual: {metricsSummary.referenceDateLabel}
                </span>
              ) : null}
              <Link
                href={`/metricas/${businessSlug}`}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Ver mas metricas
              </Link>
            </div>
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
              <div className="rounded-[22px] border border-dashed border-sky-300 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.98))] p-5">
                <p className="text-sm font-semibold text-slate-950">
                  Todavia no hay pedidos en este negocio
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {businessReadiness.canSell
                    ? "La configuracion minima ya esta lista. El siguiente paso util es abrir el formulario publico y crear un pedido corto para validar el circuito real."
                    : businessReadiness.nextStep}
                </p>
                <div className="mt-4">
                  {"onClick" in nextRecommendedAction ? (
                    <button
                      type="button"
                      onClick={nextRecommendedAction.onClick}
                      className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {nextRecommendedAction.actionLabel}
                    </button>
                  ) : (
                    <Link
                      href={nextRecommendedAction.href}
                      target={!hasOrders ? "_blank" : undefined}
                      className="inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {nextRecommendedAction.actionLabel}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Prioridad del momento
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">
            Menos duda, mas siguiente paso
          </h2>

          <div className="mt-5 space-y-3">
            {"onClick" in nextRecommendedAction ? (
              <button
                type="button"
                onClick={nextRecommendedAction.onClick}
                className="block w-full rounded-[22px] border border-sky-200 bg-sky-50 px-5 py-4 text-left transition hover:border-sky-300 hover:bg-sky-100"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  Recomendado ahora
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {nextRecommendedAction.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {nextRecommendedAction.description}
                </p>
              </button>
            ) : (
              <Link
                href={nextRecommendedAction.href}
                target={!hasOrders ? "_blank" : undefined}
                className="block rounded-[22px] border border-sky-200 bg-sky-50 px-5 py-4 transition hover:border-sky-300 hover:bg-sky-100"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  Recomendado ahora
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {nextRecommendedAction.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {nextRecommendedAction.description}
                </p>
              </Link>
            )}

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
              {nextRecommendedAction.description}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
