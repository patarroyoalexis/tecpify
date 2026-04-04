"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Check, Edit2, Plus, Save, Truck, X } from "lucide-react";

import {
  deactivateBusinessViaApi,
  updateBusinessNameViaApi,
  updateBusinessSettingsViaApi,
} from "@/lib/businesses/api";
import type { BusinessRecord } from "@/types/businesses";
import type {
  LocalDeliveryNeighborhoodOption,
  LocalDeliveryPricingBand,
} from "@/types/local-delivery";

interface BusinessSettingsListProps {
  businesses: BusinessRecord[];
  neighborhoodOptions: LocalDeliveryNeighborhoodOption[];
  catalogSchemaStatus: "ready" | "missing_db_contract";
  catalogMessage: string | null;
}

interface LocalDeliveryDraft {
  isEnabled: boolean;
  originNeighborhoodId: string;
  maxDistanceKm: string;
  pricingBands: Array<{ upToKm: string; fee: string }>;
}

function createEmptyPricingBandRow() {
  return { upToKm: "", fee: "" };
}

function createLocalDeliveryDraft(business: BusinessRecord): LocalDeliveryDraft {
  return {
    isEnabled: business.localDeliverySettings.isEnabled,
    originNeighborhoodId: business.localDeliverySettings.originNeighborhoodId ?? "",
    maxDistanceKm:
      business.localDeliverySettings.maxDistanceKm !== null
        ? String(business.localDeliverySettings.maxDistanceKm)
        : "",
    pricingBands:
      business.localDeliverySettings.pricingBands.length > 0
        ? business.localDeliverySettings.pricingBands.map((pricingBand) => ({
            upToKm: String(pricingBand.upToKm),
            fee: String(pricingBand.fee),
          }))
        : [createEmptyPricingBandRow()],
  };
}

function buildDraftMap(businesses: BusinessRecord[]) {
  return Object.fromEntries(
    businesses.map((business) => [business.businessSlug, createLocalDeliveryDraft(business)]),
  ) as Record<string, LocalDeliveryDraft>;
}

function parseLocalDeliveryPricingBandsFromDraft(
  draft: LocalDeliveryDraft,
): LocalDeliveryPricingBand[] {
  return draft.pricingBands.flatMap((pricingBand) => {
    const normalizedUpToKm = pricingBand.upToKm.trim();
    const normalizedFee = pricingBand.fee.trim();

    if (!normalizedUpToKm || !normalizedFee) {
      return [];
    }

    const upToKm = Number(normalizedUpToKm);
    const fee = Number(normalizedFee);

    if (!Number.isFinite(upToKm) || !Number.isFinite(fee)) {
      return [];
    }

    return [
      {
        upToKm,
        fee,
      },
    ];
  });
}

function DeliveryConfigAlert({
  title,
  description,
  tone = "amber",
}: {
  title: string;
  description: string;
  tone?: "amber" | "slate";
}) {
  const className =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{description}</p>
    </div>
  );
}

export function BusinessSettingsList({
  businesses,
  neighborhoodOptions,
  catalogSchemaStatus,
  catalogMessage,
}: BusinessSettingsListProps) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingLocalDeliverySlug, setSavingLocalDeliverySlug] = useState<string | null>(null);
  const [localDeliverySuccessSlug, setLocalDeliverySuccessSlug] = useState<string | null>(null);
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, LocalDeliveryDraft>>(
    () => buildDraftMap(businesses),
  );
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpdateName(businessSlug: string) {
    if (!newName.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateBusinessNameViaApi({ businessSlug, name: newName });
      setEditingSlug(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible actualizar el nombre.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(businessSlug: string) {
    if (
      !confirm(
        "Esta baja es logica: el negocio conserva su businessId, owner e historico, deja de ser operable y libera su slug publico. Quieres darlo de baja ahora?",
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await deactivateBusinessViaApi(businessSlug);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible dar de baja el negocio.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDeliveryDraft(
    businessSlug: string,
    updater: (current: LocalDeliveryDraft) => LocalDeliveryDraft,
  ) {
    setDeliveryDrafts((current) => ({
      ...current,
      [businessSlug]: updater(
        current[businessSlug] ?? {
          isEnabled: false,
          originNeighborhoodId: "",
          maxDistanceKm: "",
          pricingBands: [createEmptyPricingBandRow()],
        },
      ),
    }));
    setLocalDeliverySuccessSlug(null);
    setError(null);
  }

  async function handleSaveLocalDelivery(business: BusinessRecord) {
    const draft = deliveryDrafts[business.businessSlug];

    if (!draft) {
      return;
    }

    const parsedPricingBands = parseLocalDeliveryPricingBandsFromDraft(draft);
    const normalizedMaxDistanceKm = draft.maxDistanceKm.trim();

    setSavingLocalDeliverySlug(business.businessSlug);
    setLocalDeliverySuccessSlug(null);
    setError(null);

    try {
      await updateBusinessSettingsViaApi({
        businessSlug: business.businessSlug,
        transferInstructions: business.transferInstructions ?? "",
        acceptsCash: business.acceptsCash,
        acceptsTransfer: business.acceptsTransfer,
        acceptsCard: business.acceptsCard,
        allowsFiado: business.allowsFiado,
        localDeliveryEnabled: draft.isEnabled,
        localDeliveryOriginNeighborhoodId: draft.originNeighborhoodId || null,
        localDeliveryMaxDistanceKm: normalizedMaxDistanceKm
          ? Number(normalizedMaxDistanceKm)
          : null,
        ...(parsedPricingBands.length > 0
          ? { localDeliveryPricingBands: parsedPricingBands }
          : {}),
      });
      setLocalDeliverySuccessSlug(business.businessSlug);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la configuracion de domicilio local.",
      );
    } finally {
      setSavingLocalDeliverySlug(null);
    }
  }

  const activeBusinesses = businesses.filter((business) => business.isActive);
  const inactiveBusinesses = businesses.filter((business) => !business.isActive);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold text-slate-950">Negocios activos</h2>
        <div className="mt-4 grid gap-4">
          {activeBusinesses.length === 0 ? (
            <p className="text-sm italic text-slate-500">Aun no tienes negocios activos.</p>
          ) : (
            activeBusinesses.map((business) => {
              const draft =
                deliveryDrafts[business.businessSlug] ?? createLocalDeliveryDraft(business);
              const isLocalDeliverySchemaReady =
                business.localDeliverySettings.schemaStatus === "ready" &&
                catalogSchemaStatus === "ready";

              return (
                <div
                  key={business.businessId}
                  className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
                  data-testid={`business-settings-active-card-${business.businessId}`}
                  data-business-id={business.businessId}
                  data-business-slug={business.businessSlug}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 pr-0 xl:pr-4">
                      {editingSlug === business.businessSlug ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdateName(business.businessSlug)}
                            disabled={isSubmitting}
                            className="rounded-lg bg-slate-900 p-1.5 text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSlug(null)}
                            disabled={isSubmitting}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-slate-900">
                              {business.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSlug(business.businessSlug);
                                setNewName(business.name);
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Activo
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">/{business.businessSlug}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/${business.businessSlug}`}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Abrir espacio de trabajo
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeactivate(business.businessSlug)}
                        disabled={isSubmitting}
                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        title="Dar de baja negocio"
                        data-testid={`business-settings-archive-button-${business.businessId}`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-slate-900 text-white">
                            <Truck className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                              Domicilio local
                            </p>
                            <h4 className="text-base font-semibold text-slate-950">
                              Configuracion comercial del storefront
                            </h4>
                          </div>
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                          El negocio define si ofrece domicilio, su barrio base, la cobertura maxima
                          y las bandas de cobro. La plataforma administra el catalogo de barrios y
                          sus coordenadas aproximadas.
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          draft.isEnabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {draft.isEnabled ? "Domicilio activo" : "Domicilio desactivado"}
                      </span>
                    </div>

                    {!isLocalDeliverySchemaReady ? (
                      <div className="mt-4">
                        <DeliveryConfigAlert
                          title="Pendiente por migraciones manuales"
                          description={
                            catalogMessage ??
                            "Faltan columnas o tablas del frente de domicilio local. La UI ya espera ese contrato, pero aun no puede persistirlo hasta que apliques las migraciones manuales."
                          }
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-4">
                      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={draft.isEnabled}
                          disabled={!isLocalDeliverySchemaReady}
                          onChange={(event) =>
                            updateDeliveryDraft(business.businessSlug, (current) => ({
                              ...current,
                              isEnabled: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            Este negocio ofrece domicilio local
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Si lo activas, el storefront podra cotizar el domicilio usando el barrio
                            seleccionado por el cliente y la regla real del negocio.
                          </p>
                        </div>
                      </label>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Barrio base del negocio
                          </span>
                          <select
                            value={draft.originNeighborhoodId}
                            disabled={!isLocalDeliverySchemaReady}
                            onChange={(event) =>
                              updateDeliveryDraft(business.businessSlug, (current) => ({
                                ...current,
                                originNeighborhoodId: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                          >
                            <option value="">Selecciona el barrio base</option>
                            {neighborhoodOptions.map((neighborhood) => (
                              <option
                                key={neighborhood.neighborhoodId}
                                value={neighborhood.neighborhoodId}
                              >
                                {neighborhood.name} · {neighborhood.cityName}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs leading-5 text-slate-500">
                            El owner no carga coordenadas. Solo elige un barrio del catalogo
                            controlado por plataforma.
                          </p>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Cobertura maxima en km
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={draft.maxDistanceKm}
                            disabled={!isLocalDeliverySchemaReady}
                            onChange={(event) =>
                              updateDeliveryDraft(business.businessSlug, (current) => ({
                                ...current,
                                maxDistanceKm: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                            placeholder="Ej: 4.5"
                          />
                          <p className="text-xs leading-5 text-slate-500">
                            Si el barrio del cliente queda fuera de esta cobertura, el storefront lo
                            marcara como fuera de cobertura.
                          </p>
                        </label>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Bandas de cobro por distancia aproximada
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              El cliente nunca ve estas bandas. Solo ve el valor final del domicilio.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!isLocalDeliverySchemaReady}
                            onClick={() =>
                              updateDeliveryDraft(business.businessSlug, (current) => ({
                                ...current,
                                pricingBands: [...current.pricingBands, createEmptyPricingBandRow()],
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar banda
                          </button>
                        </div>

                        <div className="mt-4 space-y-3">
                          {draft.pricingBands.map((pricingBand, index) => (
                            <div
                              key={`${business.businessSlug}-band-${index}`}
                              className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 lg:grid-cols-[1fr_1fr_auto]"
                            >
                              <label className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Hasta km
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={pricingBand.upToKm}
                                  disabled={!isLocalDeliverySchemaReady}
                                  onChange={(event) =>
                                    updateDeliveryDraft(business.businessSlug, (current) => ({
                                      ...current,
                                      pricingBands: current.pricingBands.map((currentBand, currentIndex) =>
                                        currentIndex === index
                                          ? { ...currentBand, upToKm: event.target.value }
                                          : currentBand,
                                      ),
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                                  placeholder="Ej: 2.0"
                                />
                              </label>

                              <label className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Valor del domicilio
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={pricingBand.fee}
                                  disabled={!isLocalDeliverySchemaReady}
                                  onChange={(event) =>
                                    updateDeliveryDraft(business.businessSlug, (current) => ({
                                      ...current,
                                      pricingBands: current.pricingBands.map((currentBand, currentIndex) =>
                                        currentIndex === index
                                          ? { ...currentBand, fee: event.target.value }
                                          : currentBand,
                                      ),
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                                  placeholder="Ej: 5000"
                                />
                              </label>

                              <div className="flex items-end">
                                <button
                                  type="button"
                                  disabled={!isLocalDeliverySchemaReady || draft.pricingBands.length === 1}
                                  onClick={() =>
                                    updateDeliveryDraft(business.businessSlug, (current) => ({
                                      ...current,
                                      pricingBands: current.pricingBands.filter(
                                        (_pricingBand, currentIndex) => currentIndex !== index,
                                      ),
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-h-6 text-sm text-slate-600">
                          {localDeliverySuccessSlug === business.businessSlug ? (
                            <span className="font-medium text-emerald-700">
                              La configuracion de domicilio local se guardo correctamente.
                            </span>
                          ) : (
                            <span>
                              La tarifa final siempre la recalcula el backend al confirmar el pedido.
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={
                            !isLocalDeliverySchemaReady ||
                            savingLocalDeliverySlug === business.businessSlug
                          }
                          onClick={() => void handleSaveLocalDelivery(business)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          <span>
                            {savingLocalDeliverySlug === business.businessSlug
                              ? "Guardando..."
                              : "Guardar domicilio local"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {inactiveBusinesses.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold text-slate-950 opacity-60">
            Negocios archivados
          </h2>
          <div className="mt-4 grid gap-4">
            {inactiveBusinesses.map((business) => (
              <div
                key={business.businessId}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 opacity-70"
                data-testid={`business-settings-inactive-card-${business.businessId}`}
                data-business-id={business.businessId}
                data-business-slug={business.businessSlug}
              >
                <div className="min-w-0 flex-1 pr-4">
                  <h3 className="truncate font-semibold text-slate-600">{business.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Estado: {business.isActive ? "Activo" : "Archivado"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">/{business.businessSlug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium italic text-slate-400">
                    Historico conservado; ya no esta disponible para operar
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
