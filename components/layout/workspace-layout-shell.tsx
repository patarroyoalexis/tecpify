"use client";

import type { ReactNode } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { AppNavbar } from "@/components/layout/app-navbar";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import type { OwnedBusinessSummary } from "@/types/businesses";

interface WorkspaceLayoutShellProps {
  businessName?: string;
  businessSlug?: string;
  operatorEmail?: string | null;
  activeTab?: "dashboard" | "pedidos" | "metricas" | "admin";
  adminHref?: string | null;
  workspaceEyebrow?: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  workspaceControls?: ReactNode;
  workspaceBusinesses?: OwnedBusinessSummary[];
  workspaceCurrentBusinessSlug?: string;
  workspaceHomeHref?: string;
  workspaceCreateBusinessHref?: string;
  showFooter?: boolean;
  children: ReactNode;
}

import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";

// ... existing props interface ...

export function WorkspaceLayoutShell({
  businessName,
  businessSlug,
  operatorEmail,
  activeTab = "dashboard",
  adminHref,
  workspaceEyebrow,
  title,
  description,
  headerActions,
  workspaceControls,
  workspaceBusinesses = [],
  workspaceCurrentBusinessSlug,
  workspaceHomeHref,
  workspaceCreateBusinessHref,
  showFooter = true,
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
        adminHref={adminHref}
        workspaceEyebrow={workspaceEyebrow}
        workspaceControls={workspaceControls}
        workspaceBusinesses={workspaceBusinesses}
        workspaceCurrentBusinessSlug={workspaceCurrentBusinessSlug}
        workspaceHomeHref={workspaceHomeHref}
        workspaceCreateBusinessHref={workspaceCreateBusinessHref}
        pageTitle={title}
      />

      <div className="flex flex-1 pt-16">
        <WorkspaceSidebar 
          businessSlug={businessSlug ?? workspaceCurrentBusinessSlug} 
          showAdmin={!!adminHref}
        />

        <main className="flex-1 lg:pl-16">
          {(description || headerActions) && (
            <WorkspacePageHeader
              title="" // Title is now in the top navbar
              description={description}
              actions={headerActions}
            />
          )}

          <section className="px-3 pb-4 pt-5 sm:px-4 sm:pb-5 lg:px-5 lg:pb-6 lg:pt-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
              {children}
            </div>
          </section>
        </main>
      </div>

      {showFooter ? (
        <div className="lg:pl-16">
          <AppFooter variant="workspace" businessSlug={businessSlug} />
        </div>
      ) : null}
    </div>
  );
}
