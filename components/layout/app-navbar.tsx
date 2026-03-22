"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";

type NavbarVariant = "marketing" | "workspace";
type WorkspaceTab = "dashboard" | "pedidos" | "metricas";
type AppNavLinkKey = "home" | "dashboard" | "pedidos" | "metricas";

interface AppNavLink {
  key: AppNavLinkKey;
  label: string;
  href: string;
}

interface AppNavbarProps {
  variant: NavbarVariant;
  operatorEmail?: string | null;
  businessName?: string;
  businessSlug?: string;
  activeTab?: WorkspaceTab;
  workspaceControls?: ReactNode;
}

const marketingLinks: AppNavLink[] = [
  { key: "home", label: "Inicio", href: "/" },
  { key: "home", label: "Como funciona", href: "/#como-funciona" },
  { key: "home", label: "Beneficios", href: "/#beneficios" },
];

function getWorkspaceLinks(businessSlug?: string): AppNavLink[] {
  const links: AppNavLink[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      href: businessSlug ? `/dashboard/${businessSlug}` : "/dashboard",
    },
  ];

  if (businessSlug) {
    links.push(
      {
        key: "pedidos",
        label: "Pedidos",
        href: `/pedidos/${businessSlug}`,
      },
      {
        key: "metricas",
        label: "Metricas",
        href: `/metricas/${businessSlug}`,
      },
    );
  }

  return links;
}

function navLinkClassName(isActive: boolean) {
  return `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-slate-950 text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
  }`;
}

export function AppNavbar({
  variant,
  operatorEmail,
  businessName,
  businessSlug,
  activeTab = "dashboard",
  workspaceControls,
}: AppNavbarProps) {
  const isWorkspace = variant === "workspace";
  const navLinks: AppNavLink[] = isWorkspace ? getWorkspaceLinks(businessSlug) : marketingLinks;
  const brandHref = isWorkspace ? "/dashboard" : "/";
  const brandSubtitle = isWorkspace
    ? businessName ?? "Centro operativo"
    : "Pedidos, catalogo y operacion ligera para pequenos negocios";
  const loginHref = "/login?redirectTo=/dashboard";
  const registerHref = "/register?redirectTo=/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-3 py-3 sm:px-4 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={brandHref} className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
              Tecpify
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {isWorkspace ? "Workspace" : "Tecpify"}
              </p>
              <p className="truncate text-xs text-slate-500">{brandSubtitle}</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {workspaceControls}

            {operatorEmail ? (
              <>
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
                  <span className="text-xs font-medium text-slate-500">Sesion</span>
                  <span className="max-w-44 truncate text-sm font-semibold text-slate-800">
                    {operatorEmail}
                  </span>
                </div>
                <LogoutButton
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                />
              </>
            ) : (
              <>
                <Link
                  href={loginHref}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Iniciar sesion
                </Link>
                <Link
                  href={registerHref}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <nav
            aria-label={isWorkspace ? "Navegacion privada" : "Navegacion principal"}
            className="flex min-w-full items-center gap-1"
          >
            {navLinks.map((link) => {
              const isActive = isWorkspace ? link.key === activeTab : link.href === "/";

              return (
                <Link
                  key={`${link.key}-${link.href}`}
                  href={link.href}
                  className={`${navLinkClassName(isActive)} whitespace-nowrap`}
                >
                  {link.label}
                </Link>
              );
            })}

            {!isWorkspace ? (
              <>
                <Link href={loginHref} className={`${navLinkClassName(false)} whitespace-nowrap`}>
                  Acceso
                </Link>
                <Link
                  href={registerHref}
                  className="ml-auto whitespace-nowrap rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  Empieza hoy
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
