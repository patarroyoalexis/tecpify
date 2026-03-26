"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, LockKeyhole, ShieldCheck } from "lucide-react";

import {
  claimLegacyBusinessOwnershipRemediationViaApi,
  requestLegacyBusinessOwnershipRemediationViaApi,
} from "@/lib/businesses/api";
import type {
  LegacyBusinessOwnershipRemediationRecord,
  LegacyBusinessRemediationStatus,
} from "@/types/businesses";

interface LegacyBusinessRemediationPanelProps {
  remediations: LegacyBusinessOwnershipRemediationRecord[];
}

function formatAuditTimestamp(value: string) {
  return `${value.replace("T", " ").slice(0, 16)} UTC`;
}

function getStatusTone(status: LegacyBusinessRemediationStatus) {
  switch (status) {
    case "ownerless_requested":
      return {
        icon: <CircleDashed className="h-5 w-5 text-sky-600" aria-hidden="true" />,
        badge: "border border-sky-200 bg-sky-50 text-sky-800",
        card: "border-sky-200 bg-sky-50/70",
        label: "No remediado",
        helper: "Solicitud registrada y pendiente de habilitacion controlada.",
      };
    case "ownerless_claimable":
      return {
        icon: <ShieldCheck className="h-5 w-5 text-amber-600" aria-hidden="true" />,
        badge: "border border-amber-200 bg-amber-50 text-amber-800",
        card: "border-amber-200 bg-amber-50/70",
        label: "Listo para claim",
        helper: "Aun es inaccesible, pero ya puedes asignarte el owner final.",
      };
    case "remediated":
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
        badge: "border border-emerald-200 bg-emerald-50 text-emerald-800",
        card: "border-emerald-200 bg-emerald-50/70",
        label: "Remediado",
        helper: "El owner ya quedo persistido y el negocio vuelve a reglas normales.",
      };
    default:
      return {
        icon: <LockKeyhole className="h-5 w-5 text-slate-500" aria-hidden="true" />,
        badge: "border border-slate-200 bg-slate-100 text-slate-700",
        card: "border-slate-200 bg-white",
        label: "Sin asignar",
        helper: "Sigue ownerless e inaccesible hasta preparar una remediacion controlada.",
      };
  }
}

export function LegacyBusinessRemediationPanel({
  remediations,
}: LegacyBusinessRemediationPanelProps) {
  const router = useRouter();
  const [businessSlug, setBusinessSlug] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localRemediations, setLocalRemediations] =
    useState<LegacyBusinessOwnershipRemediationRecord[]>(remediations);

  useEffect(() => {
    setLocalRemediations(remediations);
  }, [remediations]);

  const orderedRemediations = [...localRemediations].sort((left, right) =>
    left.businessSlug.localeCompare(right.businessSlug),
  );

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessSlug.trim()) {
      setError("Ingresa el slug del negocio legacy para iniciar la remediacion.");
      return;
    }

    setIsSubmittingRequest(true);
    setError(null);
    setFeedback(null);

    try {
      const remediation = await requestLegacyBusinessOwnershipRemediationViaApi({
        businessSlug: businessSlug.trim(),
      });

      setLocalRemediations((currentRemediations) => {
        const existingIndex = currentRemediations.findIndex(
          (currentRemediation) =>
            currentRemediation.businessId === remediation.businessId,
        );

        if (existingIndex === -1) {
          return [remediation, ...currentRemediations];
        }

        const nextRemediations = [...currentRemediations];
        nextRemediations[existingIndex] = remediation;
        return nextRemediations;
      });
      setBusinessSlug("");
      setFeedback(
        "Solicitud registrada. El negocio sigue bloqueado hasta que la asignacion controlada quede habilitada para tu email.",
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No fue posible solicitar la remediacion legacy.",
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleClaim(remediation: LegacyBusinessOwnershipRemediationRecord) {
    setClaimingSlug(remediation.businessSlug);
    setError(null);
    setFeedback(null);

    try {
      const business = await claimLegacyBusinessOwnershipRemediationViaApi({
        businessSlug: remediation.businessSlug,
      });

      setLocalRemediations((currentRemediations) =>
        currentRemediations.map((currentRemediation) =>
          currentRemediation.businessId === remediation.businessId
            ? {
                ...currentRemediation,
                remediationStatus: "remediated",
                accessStatus: "accessible",
                claimedAt: new Date().toISOString(),
              }
            : currentRemediation,
        ),
      );
      router.push(`/dashboard/${business.slug}`);
      router.refresh();
    } catch (claimError) {
      setError(
        claimError instanceof Error
          ? claimError.message
          : "No fue posible reclamar el ownership legacy.",
      );
    } finally {
      setClaimingSlug(null);
    }
  }

  return (
    <section className="rounded-[32px] border border-amber-200 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
          Remediacion legacy
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">
          Ownerless nunca opera como caso normal
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          Si conoces el slug de un negocio legacy sin owner, registra la remediacion aqui.
          El negocio queda inaccesible hasta completar la asignacion controlada y el claim final
          del owner.
        </p>
      </div>

      <div className="mt-5 grid gap-3 rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 sm:grid-cols-3">
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Paso 1
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Solicitar remediacion</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Registra el slug y deja evidencia auditable de que el negocio sigue ownerless.
          </p>
        </article>
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Paso 2
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Habilitar claim controlado</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            La asignacion se prepara para tu email autenticado, sin abrir el negocio a terceros.
          </p>
        </article>
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Paso 3
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Reclamar owner</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            El claim persiste `created_by_user_id` y desde ahi vuelven las reglas normales.
          </p>
        </article>
      </div>

      <form onSubmit={handleRequest} className="mt-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Slug del negocio legacy</span>
          <input
            value={businessSlug}
            onChange={(event) => {
              setBusinessSlug(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="ej. legacy-shop"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-950 outline-none transition ${
              error
                ? "border-rose-300 bg-rose-50/60"
                : "border-slate-200 focus:border-slate-400"
            }`}
          />
          <p className="text-xs leading-5 text-slate-500">
            Este paso no habilita acceso. Solo registra la remediacion pendiente para un negocio
            que sigue bloqueado mientras no tenga owner real.
          </p>
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {feedback}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmittingRequest}
          className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
            isSubmittingRequest
              ? "cursor-not-allowed bg-slate-400"
              : "bg-slate-950 hover:bg-slate-800"
          }`}
        >
          {isSubmittingRequest
            ? "Registrando remediacion..."
            : "Solicitar remediacion legacy"}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Remediaciones visibles para tu sesion
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Aqui ves lo que ya solicitaste, lo que esta listo para claim y lo que ya quedo
              remediado.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {orderedRemediations.length}
          </span>
        </div>

        {orderedRemediations.length > 0 ? (
          <div className="space-y-3">
            {orderedRemediations.map((remediation) => {
              const tone = getStatusTone(remediation.remediationStatus);
              const isClaimingCurrentBusiness = claimingSlug === remediation.businessSlug;

              return (
                <article
                  key={remediation.businessId}
                  className={`rounded-[24px] border p-4 ${tone.card}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {tone.icon}
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {remediation.businessSlug}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone.badge}`}
                        >
                          {tone.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {remediation.accessStatus === "accessible"
                            ? "Accesible"
                            : "Inaccesible"}
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-slate-950">
                        {remediation.businessName}
                      </h4>
                      <p className="text-sm leading-6 text-slate-600">{tone.helper}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {remediation.requestedAt ? (
                          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                            Solicitud: {formatAuditTimestamp(remediation.requestedAt)}
                          </span>
                        ) : null}
                        {remediation.claimableAt ? (
                          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                            Claim habilitado: {formatAuditTimestamp(remediation.claimableAt)}
                          </span>
                        ) : null}
                        {remediation.claimedAt ? (
                          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                            Remediado: {formatAuditTimestamp(remediation.claimedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="lg:w-[15rem]">
                      {remediation.remediationStatus === "ownerless_claimable" ? (
                        <button
                          type="button"
                          onClick={() => void handleClaim(remediation)}
                          disabled={isClaimingCurrentBusiness}
                          className={`w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition ${
                            isClaimingCurrentBusiness
                              ? "cursor-not-allowed bg-slate-400"
                              : "bg-slate-950 hover:bg-slate-800"
                          }`}
                        >
                          {isClaimingCurrentBusiness
                            ? "Reclamando owner..."
                            : "Reclamar ownership"}
                        </button>
                      ) : remediation.remediationStatus === "remediated" ? (
                        <div className="rounded-[18px] border border-emerald-200 bg-white/90 p-3 text-sm leading-6 text-emerald-900">
                          Este negocio ya quedo remediado y debe aparecer tambien en tus
                          negocios operativos.
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-slate-200 bg-white/90 p-3 text-sm leading-6 text-slate-600">
                          Aun sin acceso operativo. Espera la habilitacion controlada del claim.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm leading-6 text-slate-600">
            No hay remediaciones legacy visibles para tu sesion todavia. Si conoces el slug de un
            negocio ownerless, registra la solicitud arriba para dejar trazabilidad del caso.
          </div>
        )}
      </div>
    </section>
  );
}
