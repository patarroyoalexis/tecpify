"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Menu,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { OwnedBusinessSummary } from "@/types/businesses";

type NavbarVariant = "marketing" | "workspace";
type WorkspaceTab = "dashboard" | "pedidos" | "metricas" | "admin";
type AppNavLinkKey = "home" | WorkspaceTab;

interface AppNavLink {
  key: AppNavLinkKey;
  label: string;
  href: string;
  testId?: string;
}

interface AppNavbarProps {
  variant: NavbarVariant;
  operatorEmail?: string | null;
  businessName?: string;
  businessSlug?: string;
  activeTab?: WorkspaceTab;
  adminHref?: string | null;
  workspaceEyebrow?: string;
  workspaceControls?: ReactNode;
  workspaceBusinesses?: OwnedBusinessSummary[];
  workspaceCurrentBusinessSlug?: string;
  workspaceHomeHref?: string;
  workspaceCreateBusinessHref?: string;
  pageTitle?: string;
}

interface CurrentWorkspaceBusiness {
  businessName: string;
  businessSlug: string;
}

const marketingLinks: AppNavLink[] = [
  { key: "home", label: "Inicio", href: "/" },
  { key: "home", label: "Como funciona", href: "/#como-funciona" },
  { key: "home", label: "Beneficios", href: "/#beneficios" },
];

function getWorkspaceLinks(
  businessSlug?: string,
  adminHref?: string | null,
): AppNavLink[] {
  const links: AppNavLink[] = [];

  if (businessSlug) {
    links.push(
      {
        key: "dashboard",
        label: "Espacio de trabajo",
        href: `/dashboard/${businessSlug}`,
      },
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

  links.push({
    key: "dashboard",
    label: "Ajustes",
    href: "/ajustes",
  });

  if (adminHref) {
    links.push({
      key: "admin",
      label: "Panel interno",
      href: adminHref,
      testId: "workspace-admin-link",
    });
  }

  return links;
}

function getOperableWorkspaceBusinesses(workspaceBusinesses: OwnedBusinessSummary[]) {
  return workspaceBusinesses.filter((business) => business.isActive);
}

function resolveCurrentWorkspaceBusiness(options: {
  businessName?: string;
  businessSlug?: string;
  workspaceBusinesses: OwnedBusinessSummary[];
  workspaceCurrentBusinessSlug?: string;
}) {
  const currentBusinessSlug = options.workspaceCurrentBusinessSlug ?? options.businessSlug;
  const operableBusinesses = getOperableWorkspaceBusinesses(options.workspaceBusinesses);

  if (currentBusinessSlug) {
    const matchedBusiness = operableBusinesses.find(
      (business) => business.businessSlug === currentBusinessSlug,
    );

    if (matchedBusiness) {
      return {
        businessName: matchedBusiness.businessName,
        businessSlug: matchedBusiness.businessSlug,
      } satisfies CurrentWorkspaceBusiness;
    }
  }

  if (options.businessName && options.businessSlug) {
    return {
      businessName: options.businessName,
      businessSlug: options.businessSlug,
    } satisfies CurrentWorkspaceBusiness;
  }

  return null;
}

function resolveWorkspaceOperationSlug(options: {
  businessSlug?: string;
  currentWorkspaceBusiness: CurrentWorkspaceBusiness | null;
}) {
  return options.currentWorkspaceBusiness?.businessSlug ?? options.businessSlug ?? null;
}

export function AppNavbar({
  variant,
  operatorEmail,
  businessName,
  businessSlug,
  activeTab = "dashboard",
  adminHref,
  workspaceEyebrow = "Espacio privado",
  workspaceControls,
  workspaceBusinesses = [],
  workspaceCurrentBusinessSlug,
  workspaceHomeHref,
  workspaceCreateBusinessHref,
  pageTitle,
}: AppNavbarProps) {
  const loginHref = "/login?redirectTo=/ajustes";
  const registerHref = "/register?redirectTo=/ajustes";
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWorkspaceMobileMenuOpen, setIsWorkspaceMobileMenuOpen] = useState(false);
  const isWorkspace = variant === "workspace";
  const operableWorkspaceBusinesses = getOperableWorkspaceBusinesses(workspaceBusinesses);
  const currentWorkspaceBusiness = isWorkspace
    ? resolveCurrentWorkspaceBusiness({
        businessName,
        businessSlug,
        workspaceBusinesses: operableWorkspaceBusinesses,
        workspaceCurrentBusinessSlug,
      })
    : null;
  const workspaceOperationSlug = isWorkspace
    ? resolveWorkspaceOperationSlug({
        businessSlug,
        currentWorkspaceBusiness,
      })
    : null;
  const navLinks: AppNavLink[] = isWorkspace
    ? getWorkspaceLinks(businessSlug, adminHref)
    : marketingLinks;
  const brandHref = isWorkspace
    ? workspaceHomeHref ??
      (currentWorkspaceBusiness
        ? `/dashboard/${currentWorkspaceBusiness.businessSlug}`
        : "/ajustes")
    : "/";
  const brandSubtitle = isWorkspace
    ? currentWorkspaceBusiness?.businessName ?? businessName ?? workspaceEyebrow
    : "Pedidos y operacion clara para pequenos negocios";

  const tabLabelMap: Record<WorkspaceTab, string> = {
    dashboard: "Resumen",
    pedidos: "Pedidos",
    metricas: "Metricas",
    admin: "Administracion",
  };

  const currentSectionLabel = pageTitle ?? tabLabelMap[activeTab];

  if (isWorkspace) {
    return (
      <header className="fixed top-0 z-50 h-16 w-full border-b border-white/10 bg-[linear-gradient(180deg,rgb(var(--workspace-navbar-strong-rgb))_0%,rgb(var(--workspace-navbar-rgb))_100%)] text-white shadow-[0_16px_42px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="flex h-full w-full flex-col px-3 sm:px-4 lg:px-5">
          <div className="flex h-full items-center justify-between gap-3 lg:hidden">
            <Link href={brandHref} className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Image
                  src="/images/landing/Isotipo-Tecpify.png"
                  alt="Tecpify"
                  width={24}
                  height={24}
                  priority
                  className="h-6 w-auto"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{currentSectionLabel}</p>
                <p className="truncate text-[11px] font-medium text-slate-400">
                  {brandSubtitle}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsWorkspaceMobileMenuOpen((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]"
                aria-label={isWorkspaceMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
              >
                {isWorkspaceMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="hidden h-full items-center justify-between gap-3 lg:flex">
            <div className="flex items-center gap-3 overflow-hidden">
              <Link href={brandHref} className="shrink-0">
                <div className="flex h-10 shrink-0 items-center rounded-2xl border border-white/10 bg-slate-950/55 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Image
                    src="/images/landing/Logo-tecpify-dark-background.png"
                    alt="Tecpify"
                    width={84}
                    height={21}
                    priority
                    className="h-5 w-auto"
                  />
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <div className="h-6 w-px bg-white/20" />
                <p
                  className="truncate text-sm font-medium text-slate-400"
                  data-testid="workspace-current-business-name"
                >
                  {brandSubtitle}
                </p>
                {currentSectionLabel ? (
                  <>
                    <div className="h-6 w-px bg-white/20" />
                    <p
                      className="truncate text-sm font-semibold text-white"
                      data-testid="workspace-page-title"
                    >
                      {currentSectionLabel}
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {workspaceControls}

              {operatorEmail ? (
                <>
                  <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 lg:flex">
                    <span className="text-xs font-medium text-slate-300">Sesion</span>
                    <span className="max-w-44 truncate text-sm font-semibold text-white">
                      {operatorEmail}
                    </span>
                  </div>
                  <LogoutButton className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.12]" />
                </>
              ) : (
                <>
                  <Link
                    href={loginHref}
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Entrar
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
        </div>

        <div
          className={`${
            isWorkspaceMobileMenuOpen ? "flex" : "hidden"
          } flex-col border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl lg:hidden`}
        >
          <nav className="grid gap-1">
            {workspaceOperationSlug ? (
              <>
                <Link
                  href={`/pedidos/${workspaceOperationSlug}`}
                  onClick={() => setIsWorkspaceMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                    activeTab === "pedidos"
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>Pedidos</span>
                  {activeTab === "pedidos" ? (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  ) : null}
                </Link>

                <Link
                  href={`/metricas/${workspaceOperationSlug}`}
                  onClick={() => setIsWorkspaceMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                    activeTab === "metricas"
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Metricas</span>
                  {activeTab === "metricas" ? (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  ) : null}
                </Link>
              </>
            ) : null}

            <Link
              href="/ajustes"
              onClick={() => setIsWorkspaceMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                pathname === "/ajustes"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Ajustes</span>
            </Link>

            <div className="my-2 border-t border-white/10" />

            {operableWorkspaceBusinesses.length > 0 || workspaceCreateBusinessHref ? (
              <details className="group px-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
                  <RefreshCw className="h-4 w-4 transition group-open:rotate-180" />
                  <span>Cambiar negocio</span>
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50 transition group-open:rotate-180" />
                </summary>
                <div className="mt-1 grid gap-1 pl-11 pr-2">
                  {operableWorkspaceBusinesses
                    .filter((business) => business.businessSlug !== workspaceOperationSlug)
                    .map((business) => (
                      <Link
                        key={business.businessId}
                        href={`/dashboard/${business.businessSlug}`}
                        onClick={() => setIsWorkspaceMobileMenuOpen(false)}
                        className="rounded-xl py-2 text-xs font-medium text-slate-500 hover:text-white"
                      >
                        {business.businessName}
                      </Link>
                    ))}
                  {workspaceCreateBusinessHref ? (
                    <Link
                      href={workspaceCreateBusinessHref}
                      onClick={() => setIsWorkspaceMobileMenuOpen(false)}
                      className="py-2 text-xs font-semibold text-emerald-400/80 hover:text-emerald-400"
                    >
                      + Crear nuevo negocio
                    </Link>
                  ) : null}
                </div>
              </details>
            ) : null}

            {workspaceOperationSlug ? (
              <Link
                href={`/pedido/${workspaceOperationSlug}`}
                onClick={() => setIsWorkspaceMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Ver enlace publico</span>
              </Link>
            ) : null}

            <div className="my-2 border-t border-white/10" />

            {operatorEmail ? (
              <LogoutButton className="mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white" />
            ) : null}
          </nav>
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
                Entrar
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
        className={`${
          isMobileMenuOpen ? "grid" : "hidden"
        } border-t border-brand-border bg-[rgb(var(--brand-surface-rgb)/0.96)] lg:hidden`}
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
                  Entrar
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
