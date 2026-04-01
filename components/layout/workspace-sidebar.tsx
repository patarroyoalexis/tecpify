"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_NAV_ITEMS, ADMIN_NAV_ITEM } from "@/lib/navigation-config";

interface WorkspaceSidebarProps {
  businessSlug?: string;
  showAdmin?: boolean;
}

export function WorkspaceSidebar({ businessSlug, showAdmin }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  const navItems = [...WORKSPACE_NAV_ITEMS];
  if (showAdmin) {
    navItems.push(ADMIN_NAV_ITEM);
  }

  return (
    <aside 
      data-testid="workspace-sidebar"
      className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-64px)] w-16 flex-col border-r border-white/10 bg-slate-950 transition-all duration-300 ease-in-out hover:w-64 group lg:flex"
    >
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const href = item.href(businessSlug);
          const isActive = pathname === href || (item.key !== 'ajustes' && pathname.startsWith(href));
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={href}
              data-testid={item.testId ?? `sidebar-link-${item.key}`}
              className={`flex h-10 items-center gap-3 rounded-xl px-2.5 transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {item.label}
              </span>
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
