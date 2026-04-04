"use client";

import { useState } from "react";

import type {
  LocalDeliveryAdminCatalogSnapshot,
  LocalDeliveryCatalogImportValidationResult,
} from "@/types/local-delivery";

interface CatalogRouteSuccessPayload {
  snapshot?: LocalDeliveryAdminCatalogSnapshot;
  validation?: LocalDeliveryCatalogImportValidationResult;
  result?: {
    insertedCount: number;
    updatedCount: number;
  };
}

async function parseApiResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (CatalogRouteSuccessPayload & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "No fue posible procesar el catalogo geográfico.");
  }

  return payload ?? {};
}

async function validateCatalogJson(json: string) {
  const response = await fetch("/api/admin/local-delivery/catalog", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "validate",
      json,
    }),
  });

  return parseApiResponse(response);
}

async function importCatalogJson(json: string) {
  const response = await fetch("/api/admin/local-delivery/catalog", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "import",
      json,
    }),
  });

  return parseApiResponse(response);
}

export function LocalDeliveryCatalogPanel({
  initialSnapshot,
}: {
  initialSnapshot: LocalDeliveryAdminCatalogSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [json, setJson] = useState("");
  const [validation, setValidation] = useState<LocalDeliveryCatalogImportValidationResult | null>(
    null,
  );
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  console.log("snapshot.schemaStatus", snapshot.schemaStatus);
  console.log("validation", validation);

  async function handleValidate() {
    setIsValidating(true);
    setError(null);
    setResultMessage(null);

    try {
      const payload = await validateCatalogJson(json);
      setValidation(payload.validation ?? null);
    } catch (validationError) {
      setValidation(null);
      setError(
        validationError instanceof Error
          ? validationError.message
          : "No fue posible validar el JSON del catalogo.",
      );
    } finally {
      setIsValidating(false);
    }
  }

  async function handleImport() {
    setIsImporting(true);
    setError(null);
    setResultMessage(null);

    try {
      const payload = await importCatalogJson(json);
      setValidation(payload.validation ?? null);

      if (payload.snapshot) {
        setSnapshot(payload.snapshot);
      }

      if (payload.result) {
        setResultMessage(
          `Importacion completada: ${payload.result.insertedCount} barrio(s) nuevos y ${payload.result.updatedCount} barrio(s) actualizados.`,
        );
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "No fue posible importar el catalogo.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Catalogo geografico
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Domicilio local por barrios administrado por plataforma
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El owner no administra barrios ni coordenadas. La plataforma mantiene este catalogo
            persistido y puede actualizarlo mediante JSON estricto validado antes de importar.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Estado del esquema:{" "}
          <span className="font-semibold">
            {snapshot.schemaStatus === "ready" ? "Listo" : "Pendiente por migraciones"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ciudades
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{snapshot.cities.length}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Barrios totales
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{snapshot.totalNeighborhoods}</p>
        </article>
        <article className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Barrios activos
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{snapshot.activeNeighborhoods}</p>
        </article>
      </div>

      {snapshot.message ? (
        <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {snapshot.message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-950">JSON de importacion</span>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Formato estricto esperado:{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-700">
                {'{"cities":[{"cityKey":"...","cityName":"...","neighborhoods":[{"name":"...","latitude":4.6,"longitude":-74.1,"isActive":true}]}]}'}
              </code>
              .
            </p>
            <textarea
              rows={16}
              value={json}
              onChange={(event) => setJson(event.target.value)}
              className="mt-3 w-full rounded-[24px] border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none focus:border-slate-500"
              placeholder='{"cities":[{"cityKey":"bogota-centro","cityName":"Bogota","neighborhoods":[{"name":"La Soledad","latitude":4.637,"longitude":-74.078,"isActive":true}]}]}'
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleValidate()}
              disabled={isValidating || isImporting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {isValidating ? "Validando..." : "Validar JSON"}
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isImporting || isValidating || snapshot.schemaStatus !== "ready"}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isImporting ? "Importando..." : "Importar catalogo"}
            </button>
          </div>

          {resultMessage ? (
            <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {resultMessage}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-base font-semibold text-slate-950">Resumen por ciudad</h3>
            {snapshot.cities.length > 0 ? (
              <div className="mt-3 space-y-3">
                {snapshot.cities.map((city) => (
                  <div
                    key={city.cityKey}
                    className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-slate-950">{city.cityName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {city.activeNeighborhoodsCount} activo(s) · {city.inactiveNeighborhoodsCount} inactivo(s)
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {city.cityKey}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Todavia no hay ciudades cargadas o el esquema aun no esta listo.
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-base font-semibold text-slate-950">Validacion previa</h3>
            {validation ? (
              <div className="mt-3 space-y-3">
                <div
                  className={`rounded-[18px] border px-4 py-3 text-sm ${
                    validation.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {validation.ok
                    ? "El JSON cumple el formato esperado."
                    : "El JSON todavia tiene problemas de estructura o datos."}
                </div>

                {validation.issues.length > 0 ? (
                  <ul className="space-y-2 text-sm leading-6 text-slate-700">
                    {validation.issues.map((issue) => (
                      <li key={issue} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                        {issue}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    La validacion encontro una estructura consistente y lista para importar.
                  </p>
                )}

                {validation.neighborhoods.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Preview de barrios validos
                    </p>
                    <div className="mt-3 space-y-2">
                      {validation.neighborhoods.slice(0, 8).map((neighborhood) => (
                        <div
                          key={`${neighborhood.cityKey}-${neighborhood.name}`}
                          className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                        >
                          {neighborhood.name} · {neighborhood.cityName} · lat {neighborhood.latitude} · lng {neighborhood.longitude}
                        </div>
                      ))}
                      {validation.neighborhoods.length > 8 ? (
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          + {validation.neighborhoods.length - 8} barrio(s) adicionales en el JSON
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Pega un JSON y valida primero la estructura antes de importar.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
