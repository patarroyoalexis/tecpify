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
          { label: "Crear cuenta", href: "/register?redirectTo=/dashboard" },
          { label: "Iniciar sesion", href: "/login?redirectTo=/dashboard" },
        ];

  return (
    <footer className="border-t border-slate-200/70 bg-white/88">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="inline-flex rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
              Tecpify
            </p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">
              {variant === "workspace"
                ? "Operacion y visibilidad ligera para negocios en crecimiento."
                : "Convierte tu link de pedidos en una operacion mas clara desde el primer dia."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              MVP enfocado en catalogo basico, pedidos centralizados y metricas iniciales para
              pequenos negocios.
            </p>
          </div>

          <nav aria-label="Enlaces del footer" className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200/70 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Tecpify MVP para captacion y operacion inicial de pedidos.</p>
          <p>© 2026 Tecpify</p>
        </div>
      </div>
    </footer>
  );
}
