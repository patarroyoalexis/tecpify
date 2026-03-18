import type { ReactNode } from "react";

interface WorkspacePageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function WorkspacePageHeader({
  title,
  description,
  actions,
}: WorkspacePageHeaderProps) {
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
