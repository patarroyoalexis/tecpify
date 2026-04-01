import Link from "next/link";

import { CreateBusinessPanel } from "@/components/home/create-business-panel";
import { WorkspaceLayoutShell } from "@/components/layout/workspace-layout-shell";
import { isPlatformAdminRole } from "@/lib/auth/roles";
import {
  getBusinessDashboardHref,
  resolvePrivateWorkspaceEntryFromCookies,
} from "@/lib/auth/private-workspace";
import { requireBusinessOperatorUser } from "@/lib/auth/server";

function renderUnsupportedDashboardRole() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">
            Rol sin workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Esta cuenta no puede operar negocios en el MVP actual
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tecpify solo habilita workspaces privados para `business_owner` y `platform_admin`.
            El rol `customer` queda contemplado en contratos, pero todavia no tiene flujo activo.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Volver al inicio
          </Link>
        </section>
      </div>
    </main>
  );
}

export default async function CreateBusinessPage() {
  const operator = await requireBusinessOperatorUser("/ajustes/crear-negocio");

  if (!operator) {
    return renderUnsupportedDashboardRole();
  }

  const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);
  const activeBusiness = workspaceEntry.activeBusiness;
  const hasExistingBusinesses = workspaceEntry.ownedBusinesses.length > 0;

  return (
    <WorkspaceLayoutShell
      businessName={activeBusiness?.businessName ?? "Crear negocio"}
      operatorEmail={operator.email ?? null}
      adminHref={isPlatformAdminRole(operator.role) ? "/admin" : null}
      title={hasExistingBusinesses ? "Crear otro negocio" : "Crea tu primer negocio"}
      description={
        hasExistingBusinesses
          ? "Esta vista solo existe para dar de alta un negocio adicional. El trabajo diario sigue entrando directo al negocio activo."
          : "Esta es la unica parada previa al workspace cuando todavia no existe ningun negocio para tu sesion."
      }
      workspaceBusinesses={workspaceEntry.ownedBusinesses}
      workspaceCurrentBusinessSlug={activeBusiness?.businessSlug}
      workspaceHomeHref={
        activeBusiness
          ? getBusinessDashboardHref(activeBusiness.businessSlug)
          : "/ajustes/crear-negocio"
      }
      workspaceCreateBusinessHref={hasExistingBusinesses ? "/ajustes/crear-negocio" : undefined}
      showFooter={false}
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Entrada privada
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {hasExistingBusinesses
              ? "El workspace manda; crear negocio es secundario"
              : "Primero creas el negocio, despues entras directo a operar"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {hasExistingBusinesses
              ? "Tecpify ya no expone un dashboard general como home principal. Desde ahora el negocio activo vive en la navbar privada y esta vista queda solo para ampliar el portafolio cuando haga falta."
              : "En cuanto exista un negocio valido, la entrada privada deja de caer aqui y pasa a resolver directo al workspace operativo de ese negocio."}
          </p>

          <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="rounded-[20px] border border-white/80 bg-white/95 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Regla del MVP
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                0 negocios = alta
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                La compuerta privada solo trae al alta cuando no hay ningun negocio owned para la
                sesion actual.
              </p>
            </div>

            <div className="rounded-[20px] border border-white/80 bg-white/95 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cambio de negocio
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                Vive en Ajustes de la navbar
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Si en el futuro operas mas de un negocio, el switcher queda como accion secundaria
                dentro del mismo workspace.
              </p>
            </div>

            {activeBusiness ? (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Negocio activo
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {activeBusiness.businessName}
                </p>
                <p className="mt-1 text-sm text-slate-600">{activeBusiness.businessSlug}</p>
                <Link
                  href={getBusinessDashboardHref(activeBusiness.businessSlug)}
                  className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Volver al workspace
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <CreateBusinessPanel />
      </div>
    </WorkspaceLayoutShell>
  );
}
