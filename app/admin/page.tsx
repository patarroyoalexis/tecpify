import Link from "next/link";

import { PlatformAdminDashboard } from "@/components/admin/platform-admin-dashboard";
import { WorkspaceLayoutShell } from "@/components/layout/workspace-layout-shell";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { getAdminDashboardSnapshot } from "@/lib/data/admin-dashboard";

function renderUnauthorizedAdminAccess() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <section
          data-testid="unauthorized-admin-access"
          className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            Panel interno bloqueado
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Esta sesion no tiene rol `platform_admin`
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El panel `/admin` solo existe para operar Tecpify como producto. Si tu cuenta es
            `business_owner`, el trabajo diario sigue viviendo en `/dashboard` y en los workspaces
            por negocio.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Volver al dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  const platformAdmin = await requirePlatformAdmin("/admin");

  if (!platformAdmin) {
    return renderUnauthorizedAdminAccess();
  }

  const snapshot = await getAdminDashboardSnapshot(platformAdmin);

  return (
    <WorkspaceLayoutShell
      businessName="Admin Tecpify"
      operatorEmail={platformAdmin.email || null}
      activeTab="admin"
      adminHref="/admin"
      workspaceEyebrow="Plataforma"
      title="Panel de plataforma"
      description="Lectura global de activacion, demanda y operacion de Tecpify sin mezclarla con el workspace de un negocio."
      workspaceHomeHref="/dashboard"
      showFooter={false}
    >
      <PlatformAdminDashboard snapshot={snapshot} />
    </WorkspaceLayoutShell>
  );
}
