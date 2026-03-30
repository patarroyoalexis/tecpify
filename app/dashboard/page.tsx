import { redirect } from "next/navigation";
import Link from "next/link";

import { resolvePrivateWorkspaceEntryFromCookies } from "@/lib/auth/private-workspace";
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
            Esta cuenta no puede entrar al dashboard operativo
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El MVP actual solo habilita `/dashboard` para `business_owner` y `platform_admin`.
            El rol `customer` queda reservado para una evolucion futura de la plataforma.
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

export default async function DashboardHomePage() {
  const operator = await requireBusinessOperatorUser("/dashboard");

  if (!operator) {
    return renderUnsupportedDashboardRole();
  }

  const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);

  redirect(workspaceEntry.entryHref);
}
