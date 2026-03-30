"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BusinessWorkspaceProvider,
  useBusinessWorkspace,
} from "@/components/dashboard/business-workspace-context";
import { WorkspaceNavbar } from "@/components/dashboard/workspace-navbar";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import type { Order } from "@/types/orders";

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
  title: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

function BusinessWorkspaceShellContent({
  businessName,
  businessSlug,
  operatorEmail,
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

  return (
    <div className={`flex min-h-screen flex-col ${isOrdersPage ? "bg-workspace-shell" : ""}`}>
      <WorkspaceNavbar
        businessName={businessName}
        businessSlug={businessSlug}
        operatorEmail={operatorEmail}
        activeTab={activeTab}
        onSearch={openGlobalSearch}
        onNewOrder={openNewOrder}
        onNewProduct={openNewProduct}
      />

      <main
        className={`flex flex-1 flex-col ${isOrdersPage ? "min-h-0 bg-[linear-gradient(180deg,rgb(var(--workspace-shell-rgb))_0%,rgb(var(--workspace-panel-rgb)/0.94)_100%)]" : ""}`}
      >
        <WorkspacePageHeader
          title={title}
          description={description}
          actions={headerActions}
          immersive={isOrdersPage}
        />

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
