"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface WorkspaceHeaderProps {
  businessName: string;
  businessSlug: string;
  title: string;
  description: string;
  pathname: string;
  variant?: "default" | "compact";
  headerAction?: ReactNode;
}

const tabs = [
  { label: "Dashboard", getHref: (businessSlug: string) => `/dashboard/${businessSlug}` },
  { label: "Pedidos", getHref: (businessSlug: string) => `/pedidos/${businessSlug}` },
  { label: "Metricas", getHref: (businessSlug: string) => `/metricas/${businessSlug}` },
];

export function WorkspaceHeader({
  businessName,
  businessSlug,
  title,
  description,
  pathname,
  variant = "default",
  headerAction,
}: WorkspaceHeaderProps) {
  const isCompact = variant === "compact";

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
      <div
        className={`bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),transparent_36%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eef2ff_100%)] ${
          isCompact ? "px-4 py-4 sm:px-6 sm:py-5" : "px-6 py-7 sm:px-8"
        }`}
      >
        <div
          className={`flex flex-col ${
            isCompact
              ? "gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(28rem,34rem)] xl:items-end xl:gap-6"
              : "gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(28rem,34rem)] xl:items-end xl:gap-8"
          }`}
        >
          <div className={`min-w-0 ${isCompact ? "space-y-2" : "space-y-3"}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100">
                Tecpify
              </span>

              {headerAction ? <div className="shrink-0 lg:hidden">{headerAction}</div> : null}
            </div>

            <div className={isCompact ? "space-y-0.5" : "space-y-1"}>
              <p className="text-sm font-medium text-slate-500">{businessName}</p>
              <h1
                className={`${
                  isCompact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
                } font-semibold tracking-tight text-slate-950`}
              >
                {title}
              </h1>
              {description ? (
                <p
                  className={`max-w-3xl text-sm leading-6 text-slate-600 sm:text-base ${
                    isCompact ? "hidden sm:block" : ""
                  }`}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={`flex w-full flex-col ${
              isCompact ? "gap-2.5" : "gap-3"
            } xl:min-w-[28rem] xl:shrink-0 xl:justify-self-end`}
          >
            {headerAction ? (
              <div className="hidden lg:flex lg:w-full lg:justify-end lg:self-end lg:shrink-0">
                {headerAction}
              </div>
            ) : null}

            <nav
              aria-label="Navegacion privada"
              className={`flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white/80 ${
                isCompact ? "p-1.5 sm:p-2" : "p-2 sm:p-2.5"
              } xl:min-w-[28rem] xl:flex-nowrap xl:gap-2.5`}
            >
              {tabs.map((tab) => {
                const href = tab.getHref(businessSlug);
                const isActive = pathname === href;

                return (
                  <Link
                    key={tab.label}
                    href={href}
                    className={`rounded-2xl ${
                      isCompact ? "px-3 py-2.5" : "px-4 py-3"
                    } text-sm font-medium transition sm:flex-1 sm:text-center xl:px-5 xl:py-3.5 ${
                      isActive
                        ? "bg-slate-900 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}
