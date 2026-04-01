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
  icon: any;
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
    href: (businessSlug) => `/pedidos/${businessSlug}`,
    icon: ClipboardList,
  },
  {
    key: "metricas",
    label: "Métricas",
    href: (businessSlug) => `/metricas/${businessSlug}`,
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
