"use client";

import Link from "next/link";
import { useState } from "react";
import { 
  ClipboardList, 
  Package, 
  CheckCircle2, 
  Truck, 
  TrendingUp, 
  ExternalLink, 
  PlusCircle, 
  Copy,
  AlertCircle,
  Clock,
  ArrowRight,
  Target,
  ChevronRight,
  ShoppingBag,
  DollarSign
} from "lucide-react";

import type { BusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import {
  formatCurrency,
  getOrdersMetricsSummary,
  formatElapsedTime,
} from "@/data/orders";
import {
  getOrderDisplayCode,
} from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";
import { isSameUtcCalendarDay } from "@/lib/operational-time";
import { getCurrentDate } from "@/lib/operational-time";

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
    openNewOrder,
  } = useBusinessWorkspace();

  const [copyFeedback, setCopyFeedback] = useState(false);

  const metricsSummary = getOrdersMetricsSummary(ordersState);
  const referenceDate = getCurrentDate();
  
  const todayOrders = ordersState.filter(o => 
    isSameUtcCalendarDay(new Date(o.createdAt), referenceDate)
  );

  const stats = {
    nuevos: ordersState.filter(o => o.status === "nuevo").length,
    enPreparacion: ordersState.filter(o => o.status === "en preparación").length,
    listos: ordersState.filter(o => o.status === "listo").length,
    entregadosHoy: todayOrders.filter(o => o.status === "entregado").length,
    ventasHoy: todayOrders
      .filter(o => o.status === "entregado" || o.status === "listo" || o.status === "confirmado")
      .reduce((acc, o) => acc + o.total, 0),
  };

  const handleCopyLink = () => {
    const businessUrl = `${window.location.origin}/pedido/${businessSlug}`;
    void navigator.clipboard.writeText(businessUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const recentOrders = [...ordersState]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const isReady = businessReadiness.canSell;

  const lastOrderTimeLabel = recentOrders[0] 
    ? `Último pedido: ${formatElapsedTime(recentOrders[0])}`
    : "Todavía no hay pedidos";

  const immediateActions = [
    ...(metricsSummary.pendingPaymentsCount > 0 ? [{
      label: `Hay ${metricsSummary.pendingPaymentsCount} pago${metricsSummary.pendingPaymentsCount > 1 ? "s" : ""} por verificar`,
      href: `/pedidos/${businessSlug}`,
      icon: <DollarSign className="h-4 w-4 text-orange-600" />,
      cta: "Revisar"
    }] : []),
    ...(ordersState.filter(o => o.status === "nuevo").length > 0 ? [{
      label: `${ordersState.filter(o => o.status === "nuevo").length} pedido lleva mucho tiempo sin revisar`,
      href: `/pedidos/${businessSlug}`,
      icon: <Clock className="h-4 w-4 text-orange-600" />,
      cta: "Ver ahora"
    }] : []),
    ...(businessReadiness.activeProducts === 0 ? [{
      label: "No tienes productos activos en el catálogo",
      onClick: openProductsManager,
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
      cta: "Ver catálogo"
    }] : [])
  ];

  return (
    <div className="space-y-8 pb-12">
      {ordersError ? (
        <section className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{ordersError}</p>
        </section>
      ) : null}

      {/* 1. Header interno del Dashboard */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-slate-500">Resumen operativo de tu negocio</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {copyFeedback ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copyFeedback ? "Copiado" : "Copiar link"}
          </button>
          <Link
            href={`/pedido/${businessSlug}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Ver tienda
          </Link>
          <button
            onClick={openNewOrder}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo pedido manual
          </button>
        </div>
      </header>

      {/* 2. Banner de estado general del negocio */}
      <section className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[24px] border px-6 py-4 ${
        isReady 
          ? "border-emerald-100 bg-emerald-50/50" 
          : "border-amber-100 bg-amber-50/50"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isReady ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
          }`}>
            {isReady ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div>
            <p className={`font-semibold ${isReady ? "text-emerald-950" : "text-amber-950"}`}>
              {isReady 
                ? "Tu negocio está activo y listo para recibir pedidos" 
                : "Tu negocio requiere atención para empezar a vender"}
            </p>
            <div className={`mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm ${
              isReady ? "text-emerald-700/80" : "text-amber-700/80"
            }`}>
              <span className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${businessReadiness.activeProducts > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                Catálogo activo ({businessReadiness.activeProducts} productos)
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Link público habilitado
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Pagos configurados
              </span>
            </div>
          </div>
        </div>
        <div className={`text-sm font-medium sm:block ${isReady ? "text-emerald-800" : "text-amber-800"}`}>
          {lastOrderTimeLabel}
        </div>
      </section>

      {/* 3. Tarjetas resumen */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
          <p className="text-sm font-medium text-slate-500">Pedidos nuevos</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{stats.nuevos}</p>
          <p className="mt-1 text-xs text-slate-400">Pendientes de revisión</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
          <p className="text-sm font-medium text-slate-500">En preparación</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{stats.enPreparacion}</p>
          <p className="mt-1 text-xs text-slate-400">Producción activa</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
          <p className="text-sm font-medium text-slate-500">Listos para entregar</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{stats.listos}</p>
          <p className="mt-1 text-xs text-slate-400">Esperando salida</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
          <p className="text-sm font-medium text-slate-500">Entregados hoy</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{stats.entregadosHoy}</p>
          <p className="mt-1 text-xs text-slate-400">Cierres del día</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
          <p className="text-sm font-medium text-slate-500">Ventas de hoy</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(stats.ventasHoy)}</p>
          <p className="mt-1 text-xs text-slate-400">Ingresos proyectados</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Zona Izquierda */}
        <div className="space-y-8 lg:col-span-8">
          {/* 4. Flujo operativo del día */}
          <section className="rounded-[32px] border border-slate-200 bg-white p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Flujo operativo del día</h2>
                <p className="text-sm text-slate-500">Estado de la operación en tiempo real</p>
              </div>
              <Link
                href={`/pedidos/${businessSlug}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-950 hover:underline"
              >
                Ir a gestión completa
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Nuevo", status: "nuevo", color: "bg-sky-500" },
                { label: "Confirmado", status: "confirmado", color: "bg-amber-500" },
                { label: "Preparación", status: "en preparación", color: "bg-orange-500" },
                { label: "Listo", status: "listo", color: "bg-emerald-500" },
                { label: "Entregado", status: "entregado", color: "bg-teal-500" }
              ].map((step) => {
                const count = ordersState.filter(o => o.status === step.status).length;
                return (
                  <div key={step.label} className="relative rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className={`absolute left-4 top-4 h-1.5 w-1.5 rounded-full ${step.color}`} />
                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{step.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{count}</p>
                    <p className="mt-1 text-[10px] text-slate-400">pedidos activos</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6. Pedidos recientes */}
          <section className="rounded-[32px] border border-slate-200 bg-white overflow-hidden">
            <div className="p-8 pb-4">
              <h2 className="text-xl font-bold text-slate-950">Pedidos recientes</h2>
              <p className="text-sm text-slate-500">Últimos movimientos registrados</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Pedido</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Estado</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Hora</th>
                    <th className="px-8 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length > 0 ? (
                    recentOrders.map((order) => (
                      <tr key={order.orderId} className="group hover:bg-slate-50/50 transition">
                        <td className="px-8 py-4">
                          <span className="font-mono text-xs font-bold text-slate-400">#{getOrderDisplayCode(order)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-950">{order.client}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-950">{formatCurrency(order.total)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <Link
                            href={`/pedidos/${businessSlug}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-sm text-slate-400">
                        No hay pedidos recientes registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {recentOrders.length > 0 && (
              <div className="border-t border-slate-100 p-4 text-center">
                <Link
                  href={`/pedidos/${businessSlug}`}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-950"
                >
                  Ver todos los pedidos
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Zona Derecha */}
        <div className="space-y-8 lg:col-span-4">
          {/* 5.1 Atención inmediata */}
          <section className="rounded-[32px] border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${immediateActions.length > 0 ? "bg-orange-500" : "bg-emerald-500"}`} />
              <h2 className="text-lg font-bold text-slate-950">Atención inmediata</h2>
            </div>
            <div className="mt-5 space-y-3">
              {immediateActions.length > 0 ? (
                immediateActions.map((action, idx) => (
                  <div key={idx} className="group flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-orange-200 hover:bg-orange-50/30">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-relaxed text-slate-700">{action.label}</p>
                      {"onClick" in action ? (
                        <button
                          onClick={action.onClick}
                          className="mt-2 text-xs font-bold text-slate-950 hover:underline"
                        >
                          {action.cta}
                        </button>
                      ) : (
                        <Link
                          href={action.href}
                          className="mt-2 inline-block text-xs font-bold text-slate-950 hover:underline"
                        >
                          {action.cta}
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-500">Todo al día</p>
                </div>
              )}
            </div>
          </section>

          {/* 5.2 Actividad reciente */}
          <section className="rounded-[32px] border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">Actividad reciente</h2>
            <div className="mt-5 relative">
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-6">
                {recentOrders.length > 0 ? (
                  recentOrders.slice(0, 4).map((order, idx) => (
                    <div key={order.orderId} className="relative pl-10">
                      <div className="absolute left-0 top-1 h-8 w-8 rounded-full border border-white bg-slate-100 flex items-center justify-center">
                        <ShoppingBag className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <p className="text-sm font-semibold text-slate-950">Nuevo pedido de {order.client}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {formatCurrency(order.total)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 py-2">Sin actividad reciente</p>
                )}
              </div>
            </div>
          </section>

          {/* 5.3 Estado de preparación */}
          <section className="rounded-[32px] border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">Estado de preparación</h2>
            <div className="mt-5 space-y-4">
              {[
                { label: "Catálogo activo", done: businessReadiness.activeProducts > 0 },
                { label: "Tienda pública habilitada", done: true },
                { label: "Pagos configurados", done: true }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">{item.label}</span>
                  {item.done ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-100" />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 7. Rendimiento del negocio */}
      <section className="rounded-[32px] border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Rendimiento del negocio</h2>
            <p className="text-sm text-slate-500">Métricas clave de desempeño comercial</p>
          </div>
          <Link
            href={`/metricas/${businessSlug}`}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver analítica completa
            <TrendingUp className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50/50 p-6">
            <p className="text-sm font-medium text-slate-500">Ventas hoy</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(stats.ventasHoy)}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              +12% vs ayer
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50/50 p-6">
            <p className="text-sm font-medium text-slate-500">Pedidos esta semana</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{metricsSummary.totalOrders}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Clock className="h-3 w-3" />
              Actualizado ahora
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50/50 p-6">
            <p className="text-sm font-medium text-slate-500">Ticket promedio</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(metricsSummary.averageTicket)}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Target className="h-3 w-3" />
              Eficiencia de venta
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50/50 p-6">
            <p className="text-sm font-medium text-slate-500">Más vendido</p>
            <p className="mt-2 text-lg font-bold text-slate-950 truncate">
              {metricsSummary.featuredProduct?.name ?? "Sin datos"}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Package className="h-3 w-3" />
              {metricsSummary.featuredProduct?.quantity ?? 0} unidades
            </div>
          </div>
        </div>

        {/* Placeholder para futura gráfica */}
        <div className="mt-8 h-48 rounded-2xl border border-dashed border-slate-200 bg-slate-50/30 flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">La gráfica de tendencia aparecerá aquí</p>
        </div>
      </section>
    </div>
  );
}
