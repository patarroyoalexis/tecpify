"use client";

import type { ReactNode } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { AppNavbar } from "@/components/layout/app-navbar";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";

interface WorkspaceLayoutShellProps {
  businessName?: string;
  businessSlug?: string;
  operatorEmail?: string | null;
  activeTab?: "dashboard" | "pedidos" | "metricas";
  title: string;
  description: string;
  headerActions?: ReactNode;
  workspaceControls?: ReactNode;
  children: ReactNode;
}

export function WorkspaceLayoutShell({
  businessName,
  businessSlug,
  operatorEmail,
  activeTab = "dashboard",
  title,
  description,
  headerActions,
  workspaceControls,
  children,
}: WorkspaceLayoutShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar
        variant="workspace"
        businessName={businessName}
        businessSlug={businessSlug}
        operatorEmail={operatorEmail}
        activeTab={activeTab}
        workspaceControls={workspaceControls}
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
