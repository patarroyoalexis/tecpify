"use client";

import { AppNavbar } from "@/components/layout/app-navbar";
import { NewActionsMenu } from "@/components/dashboard/new-actions-menu";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";

interface WorkspaceNavbarProps {
  businessName: string;
  businessSlug: string;
  operatorEmail: string | null;
  activeTab?: "dashboard" | "pedidos" | "metricas";
  onSearch: () => void;
  onNewOrder: () => void;
  onNewProduct: () => void;
}

export function WorkspaceNavbar({
  businessName,
  businessSlug,
  operatorEmail,
  activeTab = "dashboard",
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
        workspaceControls={
          <>
            <button
              type="button"
              onClick={onSearch}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
