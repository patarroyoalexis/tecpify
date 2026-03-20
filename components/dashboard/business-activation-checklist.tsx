"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, LockKeyhole } from "lucide-react";

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

interface ActivationPrimaryAction {
  label: string;
  description: string;
  helper: string;
  onClick?: () => void;
  href?: string;
}

interface ActivationJourneyStep {
  key: "create" | "activate" | "share";
  title: string;
  description: string;
  status: "completed" | "current" | "blocked";
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
      card: "border-emerald-200 bg-emerald-50/60",
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

function getJourneySteps(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
): ActivationJourneyStep[] {
  const hasProducts = businessReadiness.totalProducts > 0;
  const hasActiveProducts = businessReadiness.activeProducts > 0;

  return [
    {
      key: "create",
      title: "Crear primer producto",
      description: hasProducts
        ? "Ya hay al menos un producto cargado en este negocio."
        : "Carga un producto base para destrabar la activacion comercial.",
      status: hasProducts ? "completed" : "current",
    },
    {
      key: "activate",
      title: "Activar producto",
      description: hasActiveProducts
        ? "Ya hay al menos un producto visible para venta."
        : hasProducts
          ? "Activa el primer producto para que aparezca en el link publico."
          : "Este paso se habilita apenas exista el primer producto.",
      status: hasActiveProducts ? "completed" : hasProducts ? "current" : "blocked",
    },
    {
      key: "share",
      title: hasOrders ? "Seguir compartiendo el link" : "Probar y compartir link",
      description: businessReadiness.canSell
        ? hasOrders
          ? "El negocio ya tuvo pedidos. El link sigue listo para captar mas."
          : "Con el catalogo activo, toca validar el recorrido con un pedido de prueba."
        : "El link se vuelve comercialmente util cuando haya al menos un producto activo.",
      status: businessReadiness.canSell ? "current" : "blocked",
    },
  ];
}

function getJourneyStepTone(status: ActivationJourneyStep["status"]) {
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
      card: "border-sky-200 bg-sky-50/70",
      label: "Ahora",
    };
  }

  return {
    badge: "border border-slate-200 bg-slate-100 text-slate-700",
    card: "border-slate-200 bg-white",
    label: "Luego",
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
        Copiar link publico
      </button>
      {feedback ? <p className="text-xs text-slate-500">{feedback}</p> : null}
    </div>
  );
}

function getActivationSummary(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
) {
  if (businessReadiness.status === "no_products") {
    return {
      title: "Este negocio todavia no esta listo para recibir pedidos",
      description:
        "Crear el negocio no alcanza para activar ventas. El paso que bloquea hoy es cargar el primer producto.",
      highlight: "Prioridad inmediata: crear el primer producto del catalogo.",
      statusPill: "Paso 1 de 3",
    };
  }

  if (businessReadiness.status === "inactive_catalog") {
    return {
      title: "El catalogo ya existe, pero aun no vende",
      description:
        "El negocio ya tiene productos cargados, pero ninguno aparece en el formulario publico porque siguen inactivos.",
      highlight: "Prioridad inmediata: activar al menos un producto.",
      statusPill: "Paso 2 de 3",
    };
  }

  if (!hasOrders) {
    return {
      title: "El negocio ya quedo listo para activar su primera venta",
      description:
        "El catalogo ya esta publicado. Ahora conviene probar el link real y validar el recorrido completo con un pedido corto.",
      highlight: "Prioridad inmediata: hacer o conseguir el primer pedido de prueba.",
      statusPill: "Paso 3 de 3",
    };
  }

  return {
    title: "La activacion comercial minima ya quedo cerrada",
    description:
      "El negocio ya tiene catalogo activo y al menos un pedido registrado en el flujo real.",
    highlight: "Estado actual: activo y con base operativa en marcha.",
    statusPill: "Activado",
  };
}

function getPrimaryAction(
  businessReadiness: BusinessReadinessSnapshot,
  hasOrders: boolean,
  publicTestPath: string,
  onOpenCreateProduct: () => void,
  onOpenProductsManager: () => void,
): ActivationPrimaryAction {
  if (businessReadiness.primaryAction === "create_product") {
    return {
      label: "Crear primer producto",
      description: "Es la accion que destraba el resto del flujo comercial.",
      helper:
        "Abrimos el drawer directamente en modo creacion para que cargues el primer item del catalogo.",
      onClick: onOpenCreateProduct,
    };
  }

  if (businessReadiness.primaryAction === "activate_products") {
    return {
      label: "Activar primer producto",
      description:
        "Ya hay catalogo base. Solo falta dejar un producto visible para habilitar el link publico.",
      helper:
        "Abre la gestion de productos y activa el primero que quieras vender. En cuanto haya uno activo, el link queda listo.",
      onClick: onOpenProductsManager,
    };
  }

  if (!hasOrders) {
    return {
      label: "Hacer pedido de prueba",
      description:
        "El negocio ya puede vender. El siguiente paso natural es validar el recorrido completo desde el link real.",
      helper:
        "Abre el formulario publico en modo prueba, crea un pedido corto y luego revisalo dentro del panel.",
      href: publicTestPath,
    };
  }

  return {
    label: "Abrir storefront",
    description:
      "El negocio ya esta operando. El link publico sigue siendo la entrada para nuevos pedidos.",
    helper:
      "Desde aqui puedes revisar el formulario, copiar el link o compartirlo cuando haga falta.",
    href: publicTestPath,
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
  const publicTestPath = `${publicPath}?mode=test-order`;
  const [publicUrl, setPublicUrl] = useState(publicPath);
  const isReady = businessReadiness.canSell;
  const readinessTone = isReady
    ? {
        section:
          "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
        badge: "border border-emerald-200 bg-emerald-50 text-emerald-800",
        panel: "border-emerald-200 bg-white/90",
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

  const activationSummary = getActivationSummary(businessReadiness, hasOrders);
  const primaryAction = getPrimaryAction(
    businessReadiness,
    hasOrders,
    publicTestPath,
    onOpenCreateProduct,
    onOpenProductsManager,
  );
  const journeySteps = getJourneySteps(businessReadiness, hasOrders);

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
              {businessReadiness.headline}
            </h2>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${readinessTone.badge}`}>
              {businessReadiness.statusLabel}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {businessName}. {businessReadiness.reason}
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
              className={`h-full rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500"}`}
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
              Estado de activacion
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-semibold text-slate-950">{activationSummary.title}</h3>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${readinessTone.badge}`}>
                {activationSummary.statusPill}
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-600">{activationSummary.description}</p>
            <div
              className={`rounded-[20px] border px-4 py-3 text-sm font-medium ${
                isReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
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

            <div className="mt-4 flex flex-col gap-3">
              {primaryAction.onClick ? (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {primaryAction.label}
                </button>
              ) : null}

              {primaryAction.href ? (
                <Link
                  href={primaryAction.href}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {primaryAction.label}
                </Link>
              ) : null}

              <button
                type="button"
                onClick={onOpenProductsManager}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Ver catalogo actual
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-4">
          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ruta corta para activar este negocio
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {journeySteps.map((step, index) => {
                const tone = getJourneyStepTone(step.status);

                return (
                  <article
                    key={step.key}
                    className={`rounded-[22px] border p-4 ${tone.card}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-950">
                        {index + 1}. {step.title}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="space-y-3">
            {businessReadiness.checklist.map((item) => {
              const tone = getChecklistTone(item.status);

              return (
                <article
                  key={item.key}
                  className={`rounded-[24px] border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${tone.card}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getChecklistIcon(item.status)}
                        <p className="text-base font-semibold text-slate-950">{item.label}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                          {tone.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          {isReady ? (
            <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Link publico activo
              </p>
              <p className="mt-2 break-all text-sm font-medium text-slate-950">{publicUrl}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {hasOrders
                  ? "Este link ya esta listo para seguir compartiendose y recibir mas pedidos."
                  : "Este link ya esta listo para compartir o para hacer una prueba del primer pedido."}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <CopyPublicLinkButton publicUrl={publicUrl} />
                <Link
                  href={publicTestPath}
                  target="_blank"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {hasOrders ? "Abrir storefront" : "Probar pedido de prueba"}
                </Link>
                {!hasOrders ? (
                  <Link
                    href={`/pedidos/${businessSlug}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Despues revisar en pedidos
                  </Link>
                ) : null}
              </div>
            </section>
          ) : (
            <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Link publico
              </p>
              <div className="mt-3 rounded-[20px] border border-dashed border-slate-300 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-950">Aun no conviene compartirlo</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  El link existe, pero se vuelve util para venta apenas el negocio tenga al menos
                  un producto activo. En cuanto eso pase, aqui quedara visible para copiarlo y
                  probarlo.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenProductsManager}
                className="mt-4 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Ir a productos
              </button>
            </section>
          )}

          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estado comercial
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Productos
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {businessReadiness.totalProducts}
                </p>
              </div>
              <div className="rounded-[18px] border border-emerald-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Activos
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {businessReadiness.activeProducts}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Primer pedido
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {hasOrders ? "Listo" : "Pendiente"}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Venta habilitada
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {isReady ? "Si" : "No"}
                </p>
              </div>
            </div>

            {isReady && !hasOrders ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Ya no falta configuracion minima. El siguiente hito real es enviar un pedido de
                prueba y verificar que aparezca en la operacion interna.
              </p>
            ) : null}

            {isReady && hasOrders ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                El negocio ya salio de la etapa de activacion inicial. Desde aqui toca sostener
                catalogo, pedidos y seguimiento diario.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
