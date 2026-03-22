import type { ReactNode } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { AppNavbar } from "@/components/layout/app-navbar";

interface PublicLayoutShellProps {
  children: ReactNode;
  operatorEmail?: string | null;
}

export function PublicLayoutShell({
  children,
  operatorEmail,
}: PublicLayoutShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNavbar variant="marketing" operatorEmail={operatorEmail} />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
