import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { 
  BarChart3, 
  ClipboardList, 
  LayoutDashboard, 
  Settings, 
  Shield 
} from "lucide-react";

export interface WorkspaceNavItem {
  key: string;
  label: string;
  href: (businessSlug?: string) => string;
  icon: ComponentType<LucideProps>;
  testId?: string;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    key: "dashboard",
    label: "Workspace",
    href: (businessSlug) => businessSlug ? `/dashboard/${businessSlug}` : "/ajustes",
    icon: LayoutDashboard,
  },
  {
    key: "pedidos",
    label: "Pedidos",
    href: (businessSlug) => businessSlug ? `/pedidos/${businessSlug}` : "/ajustes",
    icon: ClipboardList,
  },
  {
    key: "metricas",
    label: "Métricas",
    href: (businessSlug) => businessSlug ? `/metricas/${businessSlug}` : "/ajustes",
    icon: BarChart3,
  },
  {
    key: "ajustes",
    label: "Ajustes",
    href: () => "/ajustes",
    icon: Settings,
  },
];

export const ADMIN_NAV_ITEM: WorkspaceNavItem = {
  key: "admin",
  label: "Admin",
  href: () => "/admin",
  icon: Shield,
  testId: "workspace-admin-link",
};
