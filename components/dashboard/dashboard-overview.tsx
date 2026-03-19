"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  businessId: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
}

function CopyPublicLinkButton({ businessId }: { businessId: string }) {
  const [feedback, setFeedback] = useState("");
  const [publicUrl, setPublicUrl] = useState(`/pedido/${businessId}`);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/pedido/${businessId}`);
  }, [businessId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setFeedback("Link copiado");
    } catch {
      setFeedback("No pudimos copiar el link");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        Copiar link publico
      </button>
      {feedback ? <p className="text-xs text-slate-500">{feedback}</p> : null}
    </div>
  );
}

function CommerceReadinessCard({
  businessId,
  businessName,
  businessReadiness,
  hasOrders,
  onOpenCreateProduct,
  onOpenProductsManager,
}: {
  businessId: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
  hasOrders: boolean;
  onOpenCreateProduct: () => void;
  onOpenProductsManager: () => void;
}) {
  const publicPath = `/pedido/${businessId}`;
  const [publicUrl, setPublicUrl] = useState(publicPath);
  const readinessTone =
    businessReadiness.status === "ready"
      ? {
          section:
            "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
          badge: "text-emerald-700",
          panel: "border-emerald-200 bg-white/90",
          statusChip:
            "border border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : {
          section:
            "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]",
          badge: "text-amber-700",
          panel: "border-white/80 bg-white/80",
          statusChip:
            "border border-amber-200 bg-amber-50 text-amber-800",
        };

  useEffect(() => {
    setPublicUrl(`${window.location.origin}${publicPath}`);
  }, [publicPath]);

  const primaryCta =
    businessReadiness.status === "no_products"
      ? {
          label: "Agregar primer producto",
          helper: "Es el siguiente paso para habilitar el catalogo.",
          action: onOpenCreateProduct,
        }
      : businessReadiness.status === "inactive_catalog"
        ? {
            label: "Activar productos",
            helper: "Abre el catalogo y activa al menos uno.",
            action: onOpenProductsManager,
          }
        : null;

  return (
    <section
      className={`rounded-[30px] border p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] ${readinessTone.section}`}
    >
      <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${readinessTone.badge}`}>
        Estado de preparacion
      </p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-950">
        {businessReadiness.headline}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        {businessName}. {businessReadiness.reason}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className={`rounded-[22px] border p-4 ${readinessTone.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Negocio
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {businessReadiness.businessExists ? "Creado" : "Pendiente"}
          </p>
        </div>
        <div className={`rounded-[22px] border p-4 ${readinessTone.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Productos
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {businessReadiness.totalProducts}
          </p>
        </div>
        <div className={`rounded-[22px] border p-4 ${readinessTone.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Activos
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {businessReadiness.activeProducts}
          </p>
        </div>
        <div className={`rounded-[22px] border p-4 ${readinessTone.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Puede vender
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {businessReadiness.canSell ? "Si" : "No"}
          </p>
        </div>
      </div>

      <div className={`mt-5 rounded-[24px] border p-4 ${readinessTone.panel}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estado actual
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readinessTone.statusChip}`}
              >
                {businessReadiness.statusLabel}
              </span>
              <p className="text-sm text-slate-600">
                {businessReadiness.canSell
                  ? "Ya puedes compartir tu link publico."
                  : "Todavia no puede recibir pedidos."}
              </p>
            </div>
          </div>

          {businessReadiness.canSell ? (
            <div className="min-w-0 sm:max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Link publico
              </p>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">{publicUrl}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`mt-5 rounded-[22px] border p-4 text-sm leading-6 text-slate-700 ${readinessTone.panel}`}>
        {businessReadiness.nextStep}
      </div>

      <div className={`mt-5 rounded-[24px] border p-4 ${readinessTone.panel}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Siguiente paso
        </p>

        {primaryCta ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-950">{primaryCta.label}</p>
              <p className="mt-1 text-sm text-slate-600">{primaryCta.helper}</p>
            </div>

            <button
              type="button"
              onClick={primaryCta.action}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {primaryCta.label}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-950">Compartir link de pedidos</p>
              <p className="mt-1 text-sm text-slate-600">
                Ya tienes catalogo activo. Comparte el formulario publico para buscar el
                primer pedido real.
              </p>
            </div>

            <Link
              href={publicPath}
              target="_blank"
              className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver formulario publico
            </Link>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        {businessReadiness.status === "no_products" ? (
          <>
            <button
              type="button"
              onClick={onOpenProductsManager}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Administrar catalogo
            </button>
          </>
        ) : null}

        {businessReadiness.status === "inactive_catalog" ? (
          <>
            <button
              type="button"
              onClick={onOpenCreateProduct}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Agregar producto
            </button>
          </>
        ) : null}

        {businessReadiness.status === "ready" ? (
          <>
            <CopyPublicLinkButton businessId={businessId} />
            <button
              type="button"
              onClick={onOpenProductsManager}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Administrar catalogo
            </button>
          </>
        ) : null}
      </div>

      {businessReadiness.canSell && !hasOrders ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Aun no tienes pedidos. El siguiente paso es compartir el link publico y esperar el
          primer pedido para activar la operacion diaria.
        </p>
      ) : null}
    </section>
  );
}

export function DashboardOverview({
  businessId,
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

      <CommerceReadinessCard
        businessId={businessId}
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
              href={`/metricas/${businessId}`}
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
              href={`/pedidos/${businessId}`}
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
              href={`/pedidos/${businessId}`}
              className="block rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <p className="text-base font-semibold text-slate-950">Ir a pedidos</p>
              <p className="mt-1 text-sm text-slate-600">
                Gestiona estados, pagos, prioridad y detalle completo.
              </p>
            </Link>

            <Link
              href={`/metricas/${businessId}`}
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
