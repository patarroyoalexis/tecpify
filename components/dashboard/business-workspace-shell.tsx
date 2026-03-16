"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface BusinessWorkspaceShellProps {
  businessName: string;
  businessSlug: string;
  title: string;
  description: string;
  children: ReactNode;
}

const tabs = [
  { label: "Dashboard", getHref: (slug: string) => `/dashboard/${slug}` },
  { label: "Pedidos", getHref: (slug: string) => `/pedidos/${slug}` },
  { label: "Metricas", getHref: (slug: string) => `/metricas/${slug}` },
];

export function BusinessWorkspaceShell({
  businessName,
  businessSlug,
  title,
  description,
  children,
}: BusinessWorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),transparent_36%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eef2ff_100%)] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
                  Tecpify
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">{businessName}</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <nav
                aria-label="Navegacion privada"
                className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white/80 p-2"
              >
                {tabs.map((tab) => {
                  const href = tab.getHref(businessSlug);
                  const isActive = pathname === href;

                  return (
                    <Link
                      key={tab.label}
                      href={href}
                      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}
