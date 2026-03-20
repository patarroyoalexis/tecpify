"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { NewActionsMenu } from "@/components/dashboard/new-actions-menu";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";

interface WorkspaceNavbarProps {
  businessName: string;
  businessSlug: string;
  operatorEmail: string | null;
  activeTab?: "dashboard" | "pedidos" | "metricas";
  onSearch: () => void;
  onNewOrder: () => void;
  onNewProduct: () => void;
}

const tabs = [
  { key: "dashboard" as const, label: "Dashboard", getHref: (slug: string) => `/dashboard/${slug}` },
  { key: "pedidos" as const, label: "Pedidos", getHref: (slug: string) => `/pedidos/${slug}` },
  { key: "metricas" as const, label: "Metricas", getHref: (slug: string) => `/metricas/${slug}` },
];

export function WorkspaceNavbar({
  businessName,
  businessSlug,
  operatorEmail,
  activeTab = "dashboard",
  onSearch,
  onNewOrder,
  onNewProduct,
}: WorkspaceNavbarProps) {
  return (
    <>
      <header className="border-b border-slate-200/70 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-3 py-3 sm:px-4 lg:px-5">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 sm:hidden">
            <Link
              href={`/dashboard/${businessSlug}`}
              className="flex h-10 items-center justify-start"
            >
              <span className="inline-flex shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
                Tecpify
              </span>
            </Link>

            <div className="min-w-0 px-1 text-center">
              <p className="text-sm font-semibold leading-5 text-slate-700">
                {businessName}
              </p>
            </div>

            <button
              type="button"
              onClick={onSearch}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Buscar pedidos globalmente"
              title="Buscar pedidos globalmente"
            >
              <OrdersUiIcon icon="search" className="h-4 w-4" />
            </button>

            {operatorEmail ? (
              <LogoutButton
                label="Salir"
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              />
            ) : null}
          </div>

          <div className="hidden items-center justify-between gap-4 sm:flex">
            <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
              <Link href={`/dashboard/${businessSlug}`} className="flex min-w-0 items-center gap-3">
                <span className="inline-flex shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
                  Tecpify
                </span>
                <span className="truncate text-sm font-semibold text-slate-700 sm:text-[15px]">
                  {businessName}
                </span>
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {operatorEmail ? (
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
                  <span className="text-xs font-medium text-slate-500">Sesion</span>
                  <span className="max-w-44 truncate text-sm font-semibold text-slate-800">
                    {operatorEmail}
                  </span>
                </div>
              ) : (
                <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 lg:flex">
                  Modo MVP sin sesion
                </div>
              )}

              <nav
                aria-label="Navegacion privada"
                className="hidden items-center gap-1 px-3 md:flex"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <Link
                      key={tab.key}
                      href={tab.getHref(businessSlug)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "bg-slate-950 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={onSearch}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="Buscar pedidos globalmente"
                title="Buscar pedidos globalmente"
              >
                <OrdersUiIcon icon="search" className="h-4 w-4" />
              </button>

              <NewActionsMenu
                onNewOrder={onNewOrder}
                onNewProduct={onNewProduct}
                variant="desktop"
              />

              {operatorEmail ? (
                <LogoutButton
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/70 px-3 py-1.5 md:hidden sm:px-4 lg:px-5">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <Link
                  key={tab.key}
                  href={tab.getHref(businessSlug)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <NewActionsMenu
        onNewOrder={onNewOrder}
        onNewProduct={onNewProduct}
        variant="mobile"
      />

    </>
  );
}
