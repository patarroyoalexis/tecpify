import Link from "next/link";

interface AppFooterProps {
  variant?: "marketing" | "workspace";
  businessSlug?: string;
}

export function AppFooter({
  variant = "marketing",
  businessSlug,
}: AppFooterProps) {
  const links =
    variant === "workspace"
      ? [
          { label: "Landing", href: "/" },
          { label: "Dashboard", href: businessSlug ? `/dashboard/${businessSlug}` : "/dashboard" },
          ...(businessSlug
            ? [
                { label: "Pedidos", href: `/pedidos/${businessSlug}` },
                { label: "Metricas", href: `/metricas/${businessSlug}` },
              ]
            : []),
        ]
      : [
          { label: "Inicio", href: "/" },
          { label: "Como funciona", href: "/#como-funciona" },
          { label: "Beneficios", href: "/#beneficios" },
          { label: "Crear cuenta", href: "/register?redirectTo=/dashboard" },
        ];

  return (
    <footer className="border-t border-brand-border bg-[rgb(var(--brand-surface-rgb)/0.78)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-lg">
            <p className="inline-flex rounded-xl bg-brand-primary-blue px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
              Tecpify
            </p>
            <h2 className="mt-4 text-lg font-semibold text-brand-primary-blue">
              {variant === "workspace"
                ? "Operacion y visibilidad ligera para negocios en crecimiento."
                : "Ordena tus pedidos, comparte tu link y opera con mas claridad."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-text-muted">
              MVP enfocado en pequenos negocios que necesitan una forma mas simple de recibir
              pedidos y organizar su operacion.
            </p>
          </div>

          <nav aria-label="Enlaces del footer" className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-brand-text-muted transition hover:border-brand-focus hover:bg-brand-surface-muted hover:text-brand-primary-blue"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-brand-border pt-4 text-sm text-brand-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Tecpify para captacion y operacion inicial de pedidos.</p>
          <p>&copy; 2026 Tecpify</p>
        </div>
      </div>
    </footer>
  );
}
