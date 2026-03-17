interface WorkspacePageHeaderProps {
  title: string;
  description: string;
}

export function WorkspacePageHeader({
  title,
  description,
}: WorkspacePageHeaderProps) {
  return (
    <section className="px-3 pt-6 sm:px-4 sm:pt-7 lg:px-5 lg:pt-8">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
    </section>
  );
}
