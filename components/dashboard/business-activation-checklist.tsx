"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, LockKeyhole } from "lucide-react";

import type {
  BusinessReadinessChecklistItem,
  BusinessReadinessSnapshot,
} from "@/lib/businesses/readiness";

interface BusinessActivationChecklistProps {
  businessId: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
  hasOrders: boolean;
  onOpenCreateProduct: () => void;
  onOpenProductsManager: () => void;
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

function CopyPublicLinkButton({ publicUrl }: { publicUrl: string }) {
  const [feedback, setFeedback] = useState("");

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
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
        Copiar link publico
      </button>
      {feedback ? <p className="text-xs text-slate-500">{feedback}</p> : null}
    </div>
  );
}

export function BusinessActivationChecklist({
  businessId,
  businessName,
  businessReadiness,
  hasOrders,
  onOpenCreateProduct,
  onOpenProductsManager,
}: BusinessActivationChecklistProps) {
  const publicPath = `/pedido/${businessId}`;
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

  return (
    <section
      className={`rounded-[30px] border p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] ${readinessTone.section}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Onboarding operativo
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

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
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

                  {item.key === "catalog_has_products" && item.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={onOpenCreateProduct}
                      className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Crear producto
                    </button>
                  ) : null}

                  {item.key === "catalog_has_active_product" && item.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={item.status === "blocked" ? onOpenCreateProduct : onOpenProductsManager}
                      className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {item.status === "blocked" ? "Crear producto" : "Activar productos"}
                    </button>
                  ) : null}

                  {item.key === "public_link_ready" ? (
                    <div className="flex flex-wrap gap-2">
                      <CopyPublicLinkButton publicUrl={publicUrl} />
                      <Link
                        href={publicPath}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Abrir formulario
                      </Link>
                    </div>
                  ) : null}

                  {item.key === "business_ready" && item.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={
                        businessReadiness.primaryAction === "create_product"
                          ? onOpenCreateProduct
                          : onOpenProductsManager
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      {businessReadiness.primaryAction === "create_product"
                        ? "Agregar primer producto"
                        : "Activar catalogo"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-4">
          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Link publico del negocio
            </p>
            <p className="mt-2 break-all text-sm font-medium text-slate-950">{publicUrl}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isReady
                ? "Ya puedes compartir este link con clientes reales."
                : "El link ya existe, pero el negocio todavia no esta listo para compartirlo ampliamente."}
            </p>
          </section>

          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Accion principal
            </p>

            {businessReadiness.primaryAction === "create_product" ? (
              <div className="mt-3 space-y-3">
                <p className="text-base font-semibold text-slate-950">Crear el primer producto</p>
                <p className="text-sm leading-6 text-slate-600">
                  Es el paso que destraba todo el onboarding operativo del negocio.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreateProduct}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Agregar primer producto
                </button>
              </div>
            ) : null}

            {businessReadiness.primaryAction === "activate_products" ? (
              <div className="mt-3 space-y-3">
                <p className="text-base font-semibold text-slate-950">Activar al menos un producto</p>
                <p className="text-sm leading-6 text-slate-600">
                  Ya tienes catalogo cargado. Solo falta volver visible al menos un producto.
                </p>
                <button
                  type="button"
                  onClick={onOpenProductsManager}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Activar productos
                </button>
              </div>
            ) : null}

            {businessReadiness.primaryAction === "share_public_link" ? (
              <div className="mt-3 space-y-3">
                <p className="text-base font-semibold text-slate-950">Compartir y probar el link</p>
                <p className="text-sm leading-6 text-slate-600">
                  El onboarding ya se completo. Ahora toca buscar el primer pedido real.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <CopyPublicLinkButton publicUrl={publicUrl} />
                  <Link
                    href={publicPath}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Probar formulario
                  </Link>
                </div>
              </div>
            ) : null}
          </section>

          <section className={`rounded-[24px] border p-4 ${readinessTone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Estado comercial
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
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
                  Listo
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {isReady ? "Si" : "No"}
                </p>
              </div>
            </div>

            {isReady && !hasOrders ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Todo quedo listo. El siguiente paso natural es compartir el link y esperar el
                primer pedido real.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
