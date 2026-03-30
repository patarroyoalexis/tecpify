"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
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
  { key: "home", label: "Cómo funciona", href: "/#como-funciona" },
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

function workspaceNavLinkClassName(isActive: boolean) {
  return `rounded-2xl border px-3.5 py-2 text-sm font-medium transition ${
    isActive
      ? "border-white/18 bg-white text-slate-950 shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
      : "border-white/8 bg-white/[0.06] text-slate-200 hover:border-white/14 hover:bg-white/[0.1] hover:text-white"
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isWorkspace = variant === "workspace";
  const navLinks: AppNavLink[] = isWorkspace ? getWorkspaceLinks(businessSlug) : marketingLinks;
  const brandHref = isWorkspace ? "/dashboard" : "/";
  const brandSubtitle = isWorkspace
    ? businessName ?? "Centro operativo"
    : "Pedidos y operacion clara para pequenos negocios";
  const loginHref = "/login?redirectTo=/dashboard";
  const registerHref = "/register?redirectTo=/dashboard";

  if (isWorkspace) {
    return (
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(180deg,rgb(var(--workspace-navbar-strong-rgb))_0%,rgb(var(--workspace-navbar-rgb))_100%)] text-white shadow-[0_16px_42px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="flex w-full flex-col px-3 py-3 sm:px-4 lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={brandHref} className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 shrink-0 items-center rounded-2xl border border-white/10 bg-slate-950/55 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Image
                  src="/images/landing/Logo-tecpify-dark-background.png"
                  alt="Tecpify"
                  width={104}
                  height={26}
                  priority
                  className="h-6 w-auto"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Workspace
                </p>
                <p className="truncate text-sm font-medium text-slate-100">{brandSubtitle}</p>
              </div>
            </Link>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {workspaceControls}

              {operatorEmail ? (
                <>
                  <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 lg:flex">
                    <span className="text-xs font-medium text-slate-300">Sesion</span>
                    <span className="max-w-44 truncate text-sm font-semibold text-white">
                      {operatorEmail}
                    </span>
                  </div>
                  <LogoutButton
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]"
                  />
                </>
              ) : (
                <>
                  <Link
                    href={loginHref}
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Iniciar sesion
                  </Link>
                  <Link
                    href={registerHref}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]"
                  >
                    Registro manual
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <nav aria-label="Navegacion privada" className="flex min-w-full items-center gap-1">
              {navLinks.map((link) => {
                const isActive = link.key === activeTab;

                return (
                  <Link
                    key={`${link.key}-${link.href}`}
                    href={link.href}
                    className={`${workspaceNavLinkClassName(isActive)} whitespace-nowrap`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-border/80 bg-[rgb(var(--brand-surface-rgb)/0.84)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 lg:py-3.5">
        <Link href={brandHref} className="flex min-w-0 items-center gap-3 lg:flex-1">
          <Image
            src="/images/landing/Tecpify-logo.png"
            alt="Tecpify"
            width={160}
            height={42}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <p className="hidden max-w-sm text-sm leading-5 text-brand-text-muted xl:block">
            Tecnifica pedidos, pagos y el control de tu negocio en un solo lugar.
          </p>
        </Link>

        <nav aria-label="Navegacion principal" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={`${link.key}-${link.href}`}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-brand-text-muted transition hover:bg-brand-surface-muted hover:text-brand-primary-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex lg:flex-1 lg:justify-end">
          {operatorEmail ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface-muted px-3 py-2">
                <span className="text-xs font-medium text-brand-text-muted">Sesion</span>
                <span className="max-w-44 truncate text-sm font-semibold text-brand-primary-blue">
                  {operatorEmail}
                </span>
              </div>
              <LogoutButton className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface px-4 text-sm font-medium text-brand-primary-blue transition hover:border-brand-focus hover:bg-brand-surface-muted" />
            </>
          ) : (
            <>
              <Link
                href={loginHref}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-primary-green px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgb(var(--brand-primary-green-rgb)/0.22)] transition hover:brightness-95"
              >
                Iniciar sesion
              </Link>
              <Link
                href={registerHref}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface px-5 text-sm font-semibold text-brand-primary-blue transition hover:border-brand-focus hover:bg-brand-surface-muted"
              >
                Registro manual
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-expanded={isMobileMenuOpen}
          aria-controls="marketing-mobile-menu"
          aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface text-brand-primary-blue transition hover:bg-brand-surface-muted lg:hidden"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        id="marketing-mobile-menu"
        className={`${isMobileMenuOpen ? "grid" : "hidden"} border-t border-brand-border bg-[rgb(var(--brand-surface-rgb)/0.96)] lg:hidden`}
      >
        <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-4 sm:px-6">
          <nav aria-label="Navegacion principal movil" className="grid gap-1">
            {navLinks.map((link) => (
              <Link
                key={`mobile-${link.key}-${link.href}`}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-brand-primary-blue transition hover:bg-brand-surface-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="grid gap-2 pt-2">
            {operatorEmail ? (
              <>
                <div className="rounded-2xl border border-brand-border bg-brand-surface-muted px-4 py-3">
                  <p className="text-xs font-medium text-brand-text-muted">Sesion activa</p>
                  <p className="mt-1 truncate text-sm font-semibold text-brand-primary-blue">
                    {operatorEmail}
                  </p>
                </div>
                <LogoutButton className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface px-4 text-sm font-medium text-brand-primary-blue transition hover:border-brand-focus hover:bg-brand-surface-muted" />
              </>
            ) : (
              <>
                <Link
                  href={loginHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-primary-green px-4 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  Iniciar sesion
                </Link>
                <Link
                  href={registerHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface px-4 text-sm font-semibold text-brand-primary-blue transition hover:border-brand-focus hover:bg-brand-surface-muted"
                >
                  Registro manual
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
