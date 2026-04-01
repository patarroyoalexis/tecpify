"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BusinessWorkspaceProvider,
  useBusinessWorkspace,
} from "@/components/dashboard/business-workspace-context";
import { WorkspaceNavbar } from "@/components/dashboard/workspace-navbar";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { setActiveBusinessViaApi } from "@/lib/businesses/api";
import type { Order } from "@/types/orders";
import type { OwnedBusinessSummary } from "@/types/businesses";

interface BusinessWorkspaceShellProps {
  businessName: string;
  businessSlug: string;
  transferInstructions: string | null;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
  operatorEmail: string | null;
  initialOrders: Order[];
  initialOrdersError?: string | null;
  workspaceBusinesses: OwnedBusinessSummary[];
  adminHref?: string | null;
  title: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";

// ... existing code ...

function BusinessWorkspaceShellContent({
  businessName,
  businessSlug,
  operatorEmail,
  workspaceBusinesses,
  adminHref,
  title,
  description,
  headerActions,
  children,
}: BusinessWorkspaceShellProps) {
  const pathname = usePathname();
  const { openGlobalSearch, openNewOrder, openNewProduct } = useBusinessWorkspace();
  const activeTab = pathname.startsWith(`/pedidos/${businessSlug}`)
    ? "pedidos"
    : pathname.startsWith(`/metricas/${businessSlug}`)
      ? "metricas"
      : "dashboard";
  const isOrdersPage = activeTab === "pedidos";

  useEffect(() => {
    void setActiveBusinessViaApi(businessSlug).catch(() => {
      return undefined;
    });
  }, [businessSlug]);

  return (
    <div className={`flex min-h-screen flex-col ${isOrdersPage ? "bg-workspace-shell" : ""}`}>
      <WorkspaceNavbar
        businessName={businessName}
        businessSlug={businessSlug}
        operatorEmail={operatorEmail}
        workspaceBusinesses={workspaceBusinesses}
        activeTab={activeTab}
        adminHref={adminHref}
        onSearch={openGlobalSearch}
        pageTitle={title}
      />

      <div className="flex flex-1 pt-16">
        <WorkspaceSidebar businessSlug={businessSlug} showAdmin={!!adminHref} />

        <main
          className={`flex flex-1 flex-col lg:pl-16 ${isOrdersPage ? "min-h-0 bg-[linear-gradient(180deg,rgb(var(--workspace-shell-rgb))_0%,rgb(var(--workspace-panel-rgb)/0.94)_100%)]" : ""}`}
        >
          {(description || headerActions) && (
            <WorkspacePageHeader
              title="" // Title is now in the top navbar
              description={description}
              actions={headerActions}
              immersive={isOrdersPage}
            />
          )}

          <section
            className={
              isOrdersPage
                ? "flex min-h-0 flex-1 flex-col px-3 pb-0 pt-4 sm:px-4 lg:px-5"
                : "px-3 pb-4 pt-5 sm:px-4 sm:pb-5 lg:px-5 lg:pb-6 lg:pt-6"
            }
          >
            <div
              className={
                isOrdersPage
                  ? "flex min-h-0 flex-1 flex-col"
                  : "mx-auto flex w-full max-w-7xl flex-col gap-4"
              }
            >
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function BusinessWorkspaceShell(props: BusinessWorkspaceShellProps) {
  const { businessSlug, initialOrders, initialOrdersError } = props;

  return (
    <BusinessWorkspaceProvider
      businessName={props.businessName}
      businessSlug={businessSlug}
      transferInstructions={props.transferInstructions}
      acceptsCash={props.acceptsCash}
      acceptsTransfer={props.acceptsTransfer}
      acceptsCard={props.acceptsCard}
      allowsFiado={props.allowsFiado}
      initialOrders={initialOrders}
      initialOrdersError={initialOrdersError}
    >
      <BusinessWorkspaceShellContent {...props} />
    </BusinessWorkspaceProvider>
  );
}
