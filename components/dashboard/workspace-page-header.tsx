import type { ReactNode } from "react";

interface WorkspacePageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  immersive?: boolean;
}

export function WorkspacePageHeader({
  title,
  description,
  actions,
  immersive = false,
}: WorkspacePageHeaderProps) {
  if (immersive) {
    return (
      <section className="border-b border-workspace-border/80 bg-[linear-gradient(180deg,rgb(var(--workspace-panel-strong-rgb)/0.96)_0%,rgb(var(--workspace-panel-rgb)/0.88)_100%)] px-3 py-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.45)] sm:px-4 lg:px-5">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-workspace-ink sm:text-[2rem]">
              {title}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-workspace-muted sm:text-[15px]">
              {description}
            </p>
          </div>

          {actions ? (
            <div className="flex shrink-0 items-start lg:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="px-3 pt-6 sm:px-4 sm:pt-7 lg:px-5 lg:pt-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-start sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
