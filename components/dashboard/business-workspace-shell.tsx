"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BusinessWorkspaceProvider,
  useBusinessWorkspace,
} from "@/components/dashboard/business-workspace-context";
import { WorkspaceNavbar } from "@/components/dashboard/workspace-navbar";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { AppFooter } from "@/components/layout/app-footer";
import type { Order } from "@/types/orders";

interface BusinessWorkspaceShellProps {
  businessName: string;
  businessSlug: string;
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

  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceNavbar
        businessName={businessName}
        businessSlug={businessSlug}
        operatorEmail={operatorEmail}
        activeTab={activeTab}
        onSearch={openGlobalSearch}
        onNewOrder={openNewOrder}
        onNewProduct={openNewProduct}
      />

      <main className="flex-1">
        <WorkspacePageHeader
          title={title}
          description={description}
          actions={headerActions}
        />

        <section className="px-3 pb-4 pt-5 sm:px-4 sm:pb-5 lg:px-5 lg:pb-6 lg:pt-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            {children}
          </div>
        </section>
      </main>

      <AppFooter variant="workspace" businessSlug={businessSlug} />
    </div>
  );
}

export function BusinessWorkspaceShell(props: BusinessWorkspaceShellProps) {
  const { businessSlug, initialOrders, initialOrdersError } = props;

  return (
    <BusinessWorkspaceProvider
      businessName={props.businessName}
      businessSlug={businessSlug}
      initialOrders={initialOrders}
      initialOrdersError={initialOrdersError}
    >
      <BusinessWorkspaceShellContent {...props} />
    </BusinessWorkspaceProvider>
  );
}
