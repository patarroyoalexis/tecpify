"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Copy,
  ExternalLink,
  LockKeyhole,
  Store,
} from "lucide-react";

import type {
  BusinessReadinessChecklistItem,
  BusinessReadinessSnapshot,
} from "@/lib/businesses/readiness";

interface BusinessActivationChecklistProps {
  businessSlug: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
  hasOrders: boolean;
  onOpenCreateProduct: () => void;
  onOpenProductsManager: () => void;
}

type ActivationStageKey =
  | "business_created"
  | "catalog_incomplete"
  | "no_active_products"
  | "ready_to_share"
  | "first_order_received";

type ActivationStageStatus = "completed" | "current" | "upcoming";

interface ActivationStage {
  key: ActivationStageKey;
  title: string;
  description: string;
  status: ActivationStageStatus;
}

interface ActivationPrimaryAction {
  label: string;
  description: string;
  helper: string;
  onClick?: () => void;
  href?: string;
}

function getChecklistIcon(status: BusinessReadinessChecklistItem["status"]) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
  }

  if (status === "blocked") {
    return <LockKeyhole className="h-5 w-5 text-amber-600" aria-hidden="true" />;
  }

  return <CircleDashed className="h-5 w-5 text-slate-400" aria-hidden="true" />;
}

function getChecklistTone(status: BusinessReadinessChecklistItem["status"]) {
  if (status === "completed") {
    return {
      badge: "border border-emerald-200 bg-emerald-50 text-emerald-800",
      card: "border-emerald-200 bg-emerald-50/70",
      label: "Completado",
    };
  }

  if (status === "blocked") {
    return {
      badge: "border border-amber-200 bg-amber-50 text-amber-800",
      card: "border-amber-200 bg-amber-50/70",
      label: "Bloqueado",
    };
  }

  return {
    badge: "border border-slate-200 bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-white",
    label: "Pendiente",
  };
}

function CopyPublicLinkButton({
  publicUrl,
  className = "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50",
}: {
  publicUrl: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setFeedback("Link publico copiado. Ya lo puedes compartir.");
    } catch {
      setFeedback("No pudimos copiar el link. Intenta de nuevo.");
    }

    timeoutRef.current = window.setTimeout(() => {
      setFeedback("");
      timeoutRef.current = null;
    }, 2400);
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void handleCopy()} className={className}>
        <Copy className="h-4 w-4" aria-hidden="true" />
        Copiar link
      </button>
      {feedback ? <p className="text-xs text-slate-500">{feedback}</p> : null}
    </div>
  );
}

function getActivationCurrentStage(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
): ActivationStageKey {
  if (hasOrders) {
    return "first_order_received";
  }

  if (businessReadiness.canSell) {
    return "ready_to_share";
  }

  if (businessReadiness.totalProducts === 0) {
    return "catalog_incomplete";
  }

  if (businessReadiness.activeProducts === 0) {
    return "no_active_products";
  }

  return "business_created";
}

function getActivationStages(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
): ActivationStage[] {
  const currentStage = getActivationCurrentStage(businessReadiness, hasOrders);
  const stageOrder: ActivationStageKey[] = [
    "business_created",
    "catalog_incomplete",
    "no_active_products",
    "ready_to_share",
    "first_order_received",
  ];
  const currentIndex = stageOrder.indexOf(currentStage);

  return [
    {
      key: "business_created",
      title: "Negocio creado",
      description: "La base ya existe y el dashboard esta listo para operar.",
      status: currentIndex > 0 ? "completed" : "current",
    },
    {
      key: "catalog_incomplete",
      title: "Catalogo incompleto",
      description:
        businessReadiness.totalProducts > 0
          ? `Ya hay ${businessReadiness.totalProducts} producto${businessReadiness.totalProducts === 1 ? "" : "s"} cargado${businessReadiness.totalProducts === 1 ? "" : "s"}.`
          : "Todavia falta crear el primer producto del negocio.",
      status:
        businessReadiness.totalProducts > 0
          ? "completed"
          : currentStage === "catalog_incomplete"
            ? "current"
            : "upcoming",
    },
    {
      key: "no_active_products",
      title: "Sin productos activos",
      description:
        businessReadiness.activeProducts > 0
          ? `Ya hay ${businessReadiness.activeProducts} producto${businessReadiness.activeProducts === 1 ? "" : "s"} activo${businessReadiness.activeProducts === 1 ? "" : "s"}.`
          : businessReadiness.totalProducts > 0
            ? "Activa al menos uno para que el formulario publico pueda vender."
            : "Este paso se destraba cuando exista el primer producto.",
      status:
        businessReadiness.activeProducts > 0
          ? "completed"
          : currentStage === "no_active_products"
            ? "current"
            : "upcoming",
    },
    {
      key: "ready_to_share",
      title: "Listo para compartir link",
      description: businessReadiness.canSell
        ? "El negocio ya puede recibir pedidos reales desde el formulario publico."
        : "El link se vuelve comercialmente util cuando exista al menos un producto activo.",
      status:
        businessReadiness.canSell
          ? hasOrders
            ? "completed"
            : "current"
          : "upcoming",
    },
    {
      key: "first_order_received",
      title: "Primer pedido recibido",
      description: hasOrders
        ? "La activacion minima ya se valido con un pedido dentro del flujo real."
        : "Cuando entre el primer pedido, el negocio ya sale de activacion inicial.",
      status: hasOrders ? "current" : "upcoming",
    },
  ];
}

function getStageTone(status: ActivationStageStatus) {
  if (status === "completed") {
    return {
      badge: "border border-emerald-200 bg-emerald-50 text-emerald-800",
      card: "border-emerald-200 bg-emerald-50/70",
      label: "Hecho",
    };
  }

  if (status === "current") {
    return {
      badge: "border border-sky-200 bg-sky-50 text-sky-800",
      card: "border-sky-200 bg-sky-50/80 shadow-[0_16px_36px_rgba(14,116,144,0.08)]",
      label: "Ahora",
    };
  }

  return {
    badge: "border border-slate-200 bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-white",
    label: "Luego",
  };
}

function getActivationSummary(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
) {
  if (hasOrders) {
    return {
      title: "El negocio ya esta operativo",
      description:
        "Ya hay catalogo activo y al menos un pedido recibido dentro del flujo real.",
      highlight: "Estado actual: negocio operativo y listo para seguir captando pedidos.",
      statusPill: "Operativo",
    };
  }

  if (businessReadiness.totalProducts === 0) {
    return {
      title: "El primer bloqueo real es cargar el catalogo minimo",
      description:
        "Crear el negocio fue solo el primer paso. Todavia no existe ningun producto para vender.",
      highlight: "Siguiente paso exacto: crear el primer producto.",
      statusPill: "Falta catalogo",
    };
  }

  if (businessReadiness.activeProducts === 0) {
    return {
      title: "El catalogo existe, pero todavia no vende",
      description:
        "Ya hay productos cargados, pero ninguno esta activo para aparecer en el formulario publico.",
      highlight: "Siguiente paso exacto: activar al menos un producto.",
      statusPill: "Falta activar",
    };
  }

  return {
    title: "El negocio ya esta listo para compartir su link publico",
    description:
      "La configuracion minima ya esta cerrada. Ahora toca probar el recorrido real y empujar el primer pedido.",
    highlight: "Siguiente paso exacto: abrir el formulario publico y crear un pedido de prueba.",
    statusPill: "Listo para vender",
  };
}

function getPrimaryAction(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
  publicPath: string,
  onOpenCreateProduct: () => void,
  onOpenProductsManager: () => void,
): ActivationPrimaryAction {
  if (businessReadiness.totalProducts === 0) {
    return {
      label: "Crear primer producto",
      description: "Es la unica accion que destraba el flujo comercial desde este punto.",
      helper: "Abrimos el drawer directamente en modo creacion para cargar el primer item.",
      onClick: onOpenCreateProduct,
    };
  }

  if (businessReadiness.activeProducts === 0) {
    return {
      label: "Activar al menos un producto",
      description:
        "Ya existe catalogo base. Solo falta dejar un producto visible para habilitar ventas.",
      helper:
        "Abre la gestion de productos y activa el primero que quieras mostrar en el formulario publico.",
      onClick: onOpenProductsManager,
    };
  }

  if (!hasOrders) {
    return {
      label: "Abrir formulario publico",
      description:
        "El negocio ya puede vender. Lo mas util ahora es probar el flujo real desde el link del cliente.",
      helper:
        "Abre el formulario, crea un pedido corto y luego confirma que aparezca en pedidos.",
      href: publicPath,
    };
  }

  return {
    label: "Abrir formulario publico",
    description:
      "El negocio ya esta operativo. El formulario sigue siendo la puerta de entrada para nuevos pedidos.",
    helper: "Desde aqui puedes revisarlo, compartirlo o usarlo para nuevas pruebas puntuales.",
    href: publicPath,
  };
}

export function BusinessActivationChecklist({
  businessSlug,
  businessName,
  businessReadiness,
  hasOrders,
  onOpenCreateProduct,
  onOpenProductsManager,
}: BusinessActivationChecklistProps) {
  const publicPath = `/pedido/${businessSlug}`;
  const [publicUrl, setPublicUrl] = useState(publicPath);
  const isReadyToSell = businessReadiness.canSell;
  const activationSummary = getActivationSummary(businessReadiness, hasOrders);
  const primaryAction = getPrimaryAction(
    businessReadiness,
    hasOrders,
    publicPath,
    onOpenCreateProduct,
    onOpenProductsManager,
  );
  const stages = getActivationStages(businessReadiness, hasOrders);
  const readinessTone = hasOrders
    ? {
        section:
          "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
        badge: "border border-emerald-200 bg-emerald-50 text-emerald-800",
        panel: "border-emerald-200 bg-white/90",
      }
    : isReadyToSell
      ? {
          section:
            "border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.98))]",
          badge: "border border-sky-200 bg-sky-50 text-sky-800",
          panel: "border-sky-200 bg-white/90",
        }
      : {
          section:
            "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]",
          badge: "border border-amber-200 bg-amber-50 text-amber-800",
          panel: "border-white/80 bg-white/90",
        };

  useEffect(() => {
    setPublicUrl(`${window.location.origin}${publicPath}`);
  }, [publicPath]);

  return (
    <section
      className={`rounded-[30px] border p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] ${readinessTone.section}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Activacion comercial
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold text-slate-950">
              {hasOrders
                ? "El negocio ya paso de activacion inicial a operacion real"
                : businessReadiness.headline}
            </h2>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readinessTone.badge}`}>
              {activationSummary.statusPill}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {businessName}. {activationSummary.description}
          </p>
        </div>

        <div className={`min-w-0 rounded-[24px] border p-4 lg:w-[20rem] ${readinessTone.panel}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Progreso de preparacion
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {businessReadiness.completedSteps}/{businessReadiness.totalSteps}
          </p>
          <p className="mt-1 text-sm text-slate-600">{businessReadiness.progressLabel}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${hasOrders ? "bg-emerald-500" : isReadyToSell ? "bg-sky-500" : "bg-amber-500"}`}
              style={{
                width: `${(businessReadiness.completedSteps / businessReadiness.totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <section className={`mt-5 rounded-[28px] border p-5 ${readinessTone.panel}`}>
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estado actual
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-semibold text-slate-950">{activationSummary.title}</h3>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${readinessTone.badge}`}>
                {hasOrders ? "Primer pedido logrado" : businessReadiness.statusLabel}
              </span>
            </div>
            <div
              className={`rounded-[20px] border px-4 py-3 text-sm font-medium ${
                hasOrders
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : isReadyToSell
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {activationSummary.highlight}
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Siguiente accion prioritaria
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-950">{primaryAction.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{primaryAction.description}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{primaryAction.helper}</p>

            <div className="mt-4">
              {primaryAction.onClick ? (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {primaryAction.label}
                </button>
              ) : null}

              {primaryAction.href ? (
                <Link
                  href={primaryAction.href}
                  target="_blank"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {primaryAction.label}
                </Link>
              ) : null}
            </div>

            {!hasOrders && isReadyToSell ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Despues del pedido de prueba, revisalo en pedidos para confirmar que el flujo quedo cerrado.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`mt-5 rounded-[24px] border p-4 ${readinessTone.panel}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Secuencia de activacion
        </p>
        <div className="mt-4 grid gap-3 xl:grid-cols-5">
          {stages.map((stage, index) => {
            const tone = getStageTone(stage.status);

            return (
              <article key={stage.key} className={`rounded-[22px] border p-4 ${tone.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-950">
                    {index + 1}. {stage.title}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stage.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {isReadyToSell ? (
            <section className={`rounded-[24px] border p-5 ${readinessTone.panel}`}>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-slate-700" aria-hidden="true" />
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Link publico del negocio
                </p>
              </div>
              <p className="mt-3 break-all rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950">
                {publicUrl}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {hasOrders
                  ? "El link ya esta validado en operacion real y puede seguir compartiendose."
                  : "Este link ya se puede compartir. Si todavia no hubo pedidos, usalo para crear una prueba real ahora mismo."}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <CopyPublicLinkButton
                  publicUrl={publicUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                />
                <Link
                  href={publicPath}
                  target="_blank"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir formulario publico
                </Link>
              </div>
            </section>
          ) : (
            <section className={`rounded-[24px] border p-5 ${readinessTone.panel}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bloqueo actual
              </p>
              <div className="mt-3 rounded-[20px] border border-dashed border-slate-300 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  El link publico todavia no conviene compartirse
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  El formulario existe, pero solo queda realmente listo para vender cuando haya al
                  menos un producto activo en el catalogo.
                </p>
              </div>
            </section>
          )}

          {!hasOrders && isReadyToSell ? (
            <section className={`rounded-[24px] border p-5 ${readinessTone.panel}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cierra el ciclo real
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                Haz un pedido de prueba desde el formulario publico
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                La configuracion minima ya esta resuelta. El siguiente hito no es editar mas el
                dashboard, sino comprobar que el negocio recibe su primer pedido en el flujo real.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={publicPath}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Ir al formulario
                </Link>
                <Link
                  href={`/pedidos/${businessSlug}`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Despues revisar pedidos
                </Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Lectura rapida
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Productos cargados
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {businessReadiness.totalProducts}
                </p>
              </div>
              <div className="rounded-[18px] border border-emerald-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Productos activos
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {businessReadiness.activeProducts}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Estado comercial
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {hasOrders ? "Operativo" : isReadyToSell ? "Listo para vender" : "En activacion"}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Primer pedido
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {hasOrders ? "Recibido" : "Pendiente"}
                </p>
              </div>
            </div>

            {hasOrders ? (
              <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
                La activacion minima ya se valido. Desde aqui el foco pasa a sostener catalogo,
                compartir el link y gestionar pedidos.
              </div>
            ) : null}

            {!hasOrders && isReadyToSell ? (
              <div className="mt-4 rounded-[18px] border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                Ya no falta configuracion base. Lo unico que separa a este negocio de la operacion
                real es recibir su primer pedido.
              </div>
            ) : null}
          </section>

          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Checklist operativo
            </p>
            <div className="mt-3 space-y-3">
              {businessReadiness.checklist.map((item) => {
                const tone = getChecklistTone(item.status);

                return (
                  <article key={item.key} className={`rounded-[20px] border p-3 ${tone.card}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {getChecklistIcon(item.status)}
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </article>
                );
              })}
            </div>

            {!isReadyToSell ? (
              <button
                type="button"
                onClick={businessReadiness.totalProducts === 0 ? onOpenCreateProduct : onOpenProductsManager}
                className="mt-4 w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {businessReadiness.totalProducts === 0
                  ? "Crear primer producto"
                  : "Activar productos"}
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
