"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/dashboard/workspace-header";

interface BusinessWorkspaceShellProps {
  businessName: string;
  businessSlug: string;
  title: string;
  description: string;
  compactHeader?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function BusinessWorkspaceShell({
  businessName,
  businessSlug,
  title,
  description,
  compactHeader = false,
  headerAction,
  children,
}: BusinessWorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <main className={`min-h-screen px-4 ${compactHeader ? "py-4 sm:py-5" : "py-6"} sm:px-6 lg:px-8 lg:py-8`}>
      <div className={`mx-auto flex w-full max-w-7xl flex-col ${compactHeader ? "gap-4 sm:gap-5" : "gap-6"}`}>
        <WorkspaceHeader
          businessName={businessName}
          businessSlug={businessSlug}
          title={title}
          description={description}
          pathname={pathname}
          variant={compactHeader ? "compact" : "default"}
          headerAction={headerAction}
        />

        {children}
      </div>
    </main>
  );
}
