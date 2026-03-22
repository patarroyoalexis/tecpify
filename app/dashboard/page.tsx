import { OperationalHome } from "@/components/home/operational-home";
import { WorkspaceLayoutShell } from "@/components/layout/workspace-layout-shell";
import { getHomeBusinesses } from "@/data/businesses";
import { requireOperatorSession } from "@/lib/auth/server";

export default async function DashboardHomePage() {
  const operator = await requireOperatorSession("/dashboard");
  const businesses = await getHomeBusinesses(operator.userId);

  return (
    <WorkspaceLayoutShell
      operatorEmail={operator.email ?? null}
      activeTab="dashboard"
      title="Centro operativo"
      description="Administra tus negocios, abre dashboards existentes y crea nuevos espacios de trabajo desde una sola entrada autenticada."
    >
      <OperationalHome businesses={businesses} operatorEmail={operator.email ?? null} />
    </WorkspaceLayoutShell>
  );
}
