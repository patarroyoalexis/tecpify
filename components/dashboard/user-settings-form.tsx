"use client";

import { useState } from "react";
import { User, Mail, Save, Trash2, AlertTriangle } from "lucide-react";
import type { UserProfile } from "@/lib/auth/user-profiles";
import { updateUserProfileViaApi, deactivateUserProfileViaApi } from "@/lib/auth/profile-api";

interface UserSettingsFormProps {
  profile: UserProfile;
  email: string;
}

export function UserSettingsForm({ profile, email }: UserSettingsFormProps) {
  const [fullName, setFullName] = useState(profile.fullName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await updateUserProfileViaApi({ fullName });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar perfil");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseAccount() {
    if (!confirm("¿ESTÁS SEGURO DE QUE DESEAS CERRAR TU CUENTA? Esta acción desactivará tu acceso y todos tus negocios de forma permanente. Los datos históricos se conservarán para analíticas, pero no podrás volver a entrar.")) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await deactivateUserProfileViaApi();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar cuenta");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-semibold text-slate-950">Datos de la Cuenta</h2>
        <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Email (no editable)</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
              <Mail className="h-4 w-4" />
              <span className="text-sm">{email}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-sm font-medium text-slate-700">Nombre Completo</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400">
              <User className="h-4 w-4 text-slate-400" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre completo"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>

          {success && <p className="text-sm text-emerald-600">Perfil actualizado correctamente.</p>}
        </form>
      </section>

      <section className="pt-10 border-t border-slate-200">
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Zona de Peligro</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-xl">
            Cerrar tu cuenta es una acción irreversible. Perderás acceso a tus negocios y al workspace operativo. 
            Los datos de pedidos y métricas se conservarán bajo anonimato técnico para fines de analítica e integridad.
          </p>
          <button
            onClick={handleCloseAccount}
            disabled={isSubmitting}
            className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Cerrar mi cuenta permanentemente
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
