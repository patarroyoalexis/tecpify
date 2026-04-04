import { WorkspaceLayoutShell } from "@/components/layout/workspace-layout-shell";
import { requireBusinessOperatorUser } from "@/lib/auth/server";
import { resolvePrivateWorkspaceEntryFromCookies } from "@/lib/auth/private-workspace";
import { getUserProfileByUserId } from "@/lib/auth/user-profiles";
import { isPlatformAdminRole } from "@/lib/auth/roles";
import { BusinessSettingsList } from "@/components/dashboard/business-settings-list";
import { UserSettingsForm } from "@/components/dashboard/user-settings-form";
import { getOwnedBusinessRecordsForUser } from "@/data/businesses";
import { getOwnerLocalDeliveryCatalogOptions } from "@/lib/data/local-delivery";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { BackButton } from "@/components/layout/back-button";

export default async function AjustesPage() {
  const operator = await requireBusinessOperatorUser("/ajustes");

  if (!operator) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md">
          <h1 className="text-2xl font-bold text-slate-900">No tienes acceso</h1>
          <p className="mt-4 text-slate-600">Esta sección solo está disponible para cuentas operativas.</p>
          <BackButton fallbackPath="/" />
        </div>
      </main>
    );
  }

  const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);
  const profile = await getUserProfileByUserId(operator.userId);
  const [ownedBusinessRecords, localDeliveryCatalog] = await Promise.all([
    getOwnedBusinessRecordsForUser(operator.userId),
    getOwnerLocalDeliveryCatalogOptions(),
  ]);

  if (!profile) {
     throw new Error("No se pudo cargar el perfil del usuario.");
  }

  const activeBusiness = workspaceEntry.activeBusiness;

  return (
    <WorkspaceLayoutShell
      businessName={activeBusiness?.businessName ?? "Ajustes"}
      operatorEmail={operator.email ?? null}
      adminHref={isPlatformAdminRole(operator.role) ? "/admin" : null}
      title="Ajustes"
      description="Actualiza tu perfil y administra los negocios vinculados a tu cuenta."
      workspaceBusinesses={workspaceEntry.ownedBusinesses}
      workspaceCurrentBusinessSlug={activeBusiness?.businessSlug}
      workspaceHomeHref="/ajustes"
      workspaceCreateBusinessHref="/ajustes/crear-negocio"
      showFooter={true}
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-12">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Mis negocios</h2>
                <p className="text-slate-500 mt-1">Revisa, edita o desactiva los negocios que operas.</p>
              </div>
              <Link
                href="/ajustes/crear-negocio"
                className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Crear negocio</span>
              </Link>
            </div>

            <BusinessSettingsList
              businesses={ownedBusinessRecords}
              neighborhoodOptions={localDeliveryCatalog.neighborhoods}
              catalogSchemaStatus={localDeliveryCatalog.schemaStatus}
              catalogMessage={localDeliveryCatalog.message}
            />
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-950">Tu perfil</h2>
            <p className="text-slate-500 mt-1 mb-8">Mantén actualizados los datos de tu cuenta.</p>

            <UserSettingsForm profile={profile} email={operator.email} />
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-bold text-slate-900">Resumen de cuenta</h3>
            <div className="mt-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Rol</span>
                <span className="font-semibold text-slate-900">{operator.role}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Negocios</span>
                <span className="font-semibold text-slate-900">{workspaceEntry.ownedBusinesses.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Activos</span>
                <span className="font-semibold text-emerald-600">{workspaceEntry.ownedBusinesses.filter(b => b.isActive).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Miembro desde</span>
                <span className="font-semibold text-slate-900">{new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-blue-100 bg-blue-50/50 p-6">
            <h3 className="font-bold text-blue-900">¿Necesitas ayuda?</h3>
            <p className="mt-2 text-sm text-blue-800/80 leading-6">
              Si algo no se ve como esperas, revisa la ayuda disponible o contacta al equipo de soporte.
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-blue-700 underline underline-offset-4">
              Ir al inicio
            </Link>
          </div>
        </aside>
      </div>
    </WorkspaceLayoutShell>
  );
}
