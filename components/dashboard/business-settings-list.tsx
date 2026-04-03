"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Edit2, X } from "lucide-react";

import { deactivateBusinessViaApi, updateBusinessNameViaApi } from "@/lib/businesses/api";
import type { OwnedBusinessSummary } from "@/types/businesses";

interface BusinessSettingsListProps {
  businesses: OwnedBusinessSummary[];
}

export function BusinessSettingsList({ businesses }: BusinessSettingsListProps) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpdateName(businessSlug: string) {
    if (!newName.trim()) return;

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
            activeBusinesses.map((business) => (
              <div
                key={business.businessId}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                data-testid={`business-settings-active-card-${business.businessId}`}
                data-business-id={business.businessId}
                data-business-slug={business.businessSlug}
              >
                <div className="min-w-0 flex-1 pr-4">
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
                        onClick={() => handleUpdateName(business.businessSlug)}
                        disabled={isSubmitting}
                        className="rounded-lg bg-slate-900 p-1.5 text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingSlug(null)}
                        disabled={isSubmitting}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">
                          {business.businessName}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingSlug(business.businessSlug);
                            setNewName(business.businessName);
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{business.businessSlug}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/${business.businessSlug}`}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Abrir espacio de trabajo
                  </Link>
                  <button
                    onClick={() => handleDeactivate(business.businessSlug)}
                    disabled={isSubmitting}
                    className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    title="Dar de baja negocio"
                    data-testid={`business-settings-archive-button-${business.businessId}`}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
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
                  <h3 className="truncate font-semibold text-slate-600">{business.businessName}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Estado: {business.isActive ? "Activo" : "Archivado"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{business.businessSlug}</p>
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
