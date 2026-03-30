"use client";

import { AppNavbar } from "@/components/layout/app-navbar";
import { NewActionsMenu } from "@/components/dashboard/new-actions-menu";
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
  onNewOrder: () => void;
  onNewProduct: () => void;
}

export function WorkspaceNavbar({
  businessName,
  businessSlug,
  operatorEmail,
  workspaceBusinesses,
  activeTab = "dashboard",
  adminHref,
  onSearch,
  onNewOrder,
  onNewProduct,
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
        workspaceCreateBusinessHref="/dashboard/crear-negocio"
        workspaceControls={
          <>
            <button
              type="button"
              onClick={onSearch}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]"
              aria-label="Buscar pedidos globalmente"
              title="Buscar pedidos globalmente"
            >
              <OrdersUiIcon icon="search" className="h-4 w-4" />
            </button>

            <NewActionsMenu
              onNewOrder={onNewOrder}
              onNewProduct={onNewProduct}
              variant="desktop"
            />
          </>
        }
      />

      <NewActionsMenu
        onNewOrder={onNewOrder}
        onNewProduct={onNewProduct}
        variant="mobile"
      />
    </>
  );
}
