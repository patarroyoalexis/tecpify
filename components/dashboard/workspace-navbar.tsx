"use client";

import { AppNavbar } from "@/components/layout/app-navbar";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import type { OwnedBusinessSummary } from "@/types/businesses";

interface WorkspaceNavbarProps {
  businessName: string;
  businessSlug: string;
  operatorEmail: string | null;
  workspaceBusinesses: OwnedBusinessSummary[];
  activeTab?: "dashboard" | "pedidos" | "metricas";
  adminHref?: string | null;
  onSearch: () => void;
  pageTitle?: string;
}

export function WorkspaceNavbar({
  businessName,
  businessSlug,
  operatorEmail,
  workspaceBusinesses,
  activeTab = "dashboard",
  adminHref,
  onSearch,
  pageTitle,
}: WorkspaceNavbarProps) {
  return (
    <>
      <AppNavbar
        variant="workspace"
        businessName={businessName}
        businessSlug={businessSlug}
        operatorEmail={operatorEmail}
        activeTab={activeTab}
        adminHref={adminHref}
        workspaceBusinesses={workspaceBusinesses}
        workspaceCurrentBusinessSlug={businessSlug}
        workspaceHomeHref={`/dashboard/${businessSlug}`}
        workspaceCreateBusinessHref="/ajustes/crear-negocio"
        pageTitle={pageTitle}
        workspaceControls={
          <button
            type="button"
            onClick={onSearch}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]"
            aria-label="Buscar pedidos"
            title="Buscar pedidos"
          >
            <OrdersUiIcon icon="search" className="h-4 w-4" />
          </button>
        }
      />
    </>
  );
}
