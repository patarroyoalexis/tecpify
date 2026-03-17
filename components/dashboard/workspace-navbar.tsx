"use client";

import Link from "next/link";

interface WorkspaceNavbarProps {
  businessName: string;
  businessSlug: string;
  activeTab?: "dashboard" | "pedidos" | "metricas";
  onSearch: () => void;
  onNewOrder: () => void;
}

const tabs = [
  { key: "dashboard" as const, label: "Dashboard", getHref: (slug: string) => `/dashboard/${slug}` },
  { key: "pedidos" as const, label: "Pedidos", getHref: (slug: string) => `/pedidos/${slug}` },
  { key: "metricas" as const, label: "Metricas", getHref: (slug: string) => `/metricas/${slug}` },
];

export function WorkspaceNavbar({
  businessName,
  businessSlug,
  activeTab = "dashboard",
  onSearch,
  onNewOrder,
}: WorkspaceNavbarProps) {
  return (
    <header className="border-b border-slate-200/70 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
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
          <nav
            aria-label="Navegacion privada"
            className="hidden items-center gap-1 md:flex px-3"
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
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onNewOrder}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <span className="text-base leading-none">+</span>
            <span>Nuevo pedido</span>
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200/70 px-3 py-1.5 md:hidden sm:px-4 lg:px-5">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto">
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
  );
}
