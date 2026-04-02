import Link from "next/link";

import { CreateBusinessPanel } from "@/components/home/create-business-panel";
import { WorkspaceLayoutShell } from "@/components/layout/workspace-layout-shell";
import { isPlatformAdminRole } from "@/lib/auth/roles";
import {
  getBusinessDashboardHref,
  resolvePrivateWorkspaceEntryFromCookies,
} from "@/lib/auth/private-workspace";
import { requireBusinessOperatorUser } from "@/lib/auth/server";
import { BackButton } from "@/components/layout/back-button";

function renderUnsupportedDashboardRole() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.16),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">
            Rol sin acceso operativo
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Esta cuenta no puede operar negocios todavía
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Solo las cuentas operativas pueden crear y administrar negocios desde esta vista.
          </p>
          <BackButton fallbackPath="/" />
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
      title={hasExistingBusinesses ? "Añadir otro negocio" : "Crea tu primer negocio"}
      description={
        hasExistingBusinesses
          ? "Esta vista te ayuda a sumar otro negocio cuando lo necesites. Tu negocio activo sigue siendo la entrada principal."
          : "Cuando guardes el primer negocio, entrarás directo a su espacio de trabajo para seguir con productos y pedidos."
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
              ? "Añade otro negocio sin salir del trabajo diario"
              : "Crea tu negocio para empezar a operar"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {hasExistingBusinesses
              ? "Esta vista te ayuda a sumar otro negocio cuando lo necesites. Tu negocio activo sigue siendo la entrada principal."
              : "Cuando guardes el primer negocio, entrarás directo a su espacio de trabajo para seguir con productos y pedidos."}
          </p>

          <div className="mt-5 space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="rounded-[20px] border border-white/80 bg-white/95 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Regla del MVP
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                Sin negocio, primero toca crear uno
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Si la sesión todavía no tiene negocios, esta pantalla te guía para crear el primero.
              </p>
            </div>

            <div className="rounded-[20px] border border-white/80 bg-white/95 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cambio de negocio
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                Cambia desde la barra privada
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Si operas más de un negocio, puedes alternar entre ellos sin perder el contexto.
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
                  Ir al espacio de trabajo
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
