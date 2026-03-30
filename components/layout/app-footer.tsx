import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface AppFooterProps {
  variant?: "marketing" | "workspace";
  businessSlug?: string;
}

interface FooterLink {
  href: string;
  label: string;
}

interface FooterGroup {
  title: string;
  links: FooterLink[];
}

const marketingFooterGroups: FooterGroup[] = [
  {
    title: "Producto",
    links: [
      { label: "Inicio", href: "/" },
      { label: "Como funciona", href: "/#como-funciona" },
      { label: "Beneficios", href: "/#beneficios" },
    ],
  },
  {
    title: "Acceso",
    links: [
      { label: "Iniciar sesion", href: "/login?redirectTo=/dashboard" },
      { label: "Registro manual secundario", href: "/register?redirectTo=/dashboard" },
      { label: "Abrir workspace", href: "/dashboard" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Privacidad", href: "/legal/privacidad" },
      { label: "Terminos", href: "/legal/terminos" },
      { label: "Tecpify", href: "/" },
    ],
  },
];

const marketingLegalLinks: FooterLink[] = [
  { label: "Privacidad", href: "/legal/privacidad" },
  { label: "Terminos", href: "/legal/terminos" },
];

const marketingLinkClassName =
  "text-sm leading-6 text-slate-300 transition hover:text-[#9DCAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.8)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081120]";

export function AppFooter({
  variant = "marketing",
  businessSlug,
}: AppFooterProps) {
  if (variant === "marketing") {
    const currentYear = new Date().getFullYear();

    return (
      <footer className="relative overflow-hidden border-t border-white/8 bg-[#071121] text-slate-100">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,181,106,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(123,184,255,0.14),transparent_30%),linear-gradient(180deg,#091426_0%,#071121_54%,#050d19_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(280px,0.8fr)] lg:gap-10 xl:gap-16 xl:py-20">
            <div className="max-w-xl">
              <Link
                href="/"
                className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.8)] focus-visible:ring-offset-4 focus-visible:ring-offset-[#081120]"
              >
                <Image
                  src="/images/landing/Logo-tecpify-dark-background.png"
                  alt="Tecpify"
                  width={160}
                  height={42}
                  className="h-10 w-auto"
                />
              </Link>

              <p className="mt-6 max-w-lg text-[1.65rem] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[1.85rem]">
                Recibe pedidos, comparte tu link y opera con una base mas clara.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-[0.96rem]">
                Tecpify concentra catalogo, pedidos y seguimiento en un flujo simple para
                negocios que necesitan verse mas profesionales sin agregar mas desorden.
              </p>

              <Link
                href="/#como-funciona"
                className={`mt-6 inline-flex items-center gap-2 font-medium ${marketingLinkClassName}`}
              >
                Ver como funciona
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <nav
              aria-label="Enlaces del footer"
              className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 xl:gap-10"
            >
              {marketingFooterGroups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {group.title}
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {group.links.map((link) => (
                      <li key={`${group.title}-${link.href}`}>
                        <Link href={link.href} className={marketingLinkClassName}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <aside className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,44,0.9),rgba(8,18,35,0.9))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)] backdrop-blur-sm sm:p-7">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(123,184,255,0.18),transparent_42%)]"
              />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A9D3FF]">
                  Operacion lista
                </p>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                  Publica rapido y entra a operar desde el carril validado.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  El acceso garantizado del MVP sigue entrando por login con una cuenta ya
                  operativa. El registro manual permanece disponible solo como carril
                  secundario.
                </p>

                <div className="mt-6 grid gap-3 border-t border-white/10 pt-5">
                  <Link
                    href="/login?redirectTo=/dashboard"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-[#9DCAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.8)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1628]"
                  >
                    Iniciar sesion
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/register?redirectTo=/dashboard"
                    className={marketingLinkClassName}
                  >
                    Registro manual secundario
                  </Link>
                </div>

                <p className="mt-6 text-xs leading-6 text-slate-400">
                  Pensado para negocios que venden por WhatsApp, Instagram o llamadas y
                  necesitan una operacion mas estable.
                </p>
              </div>
            </aside>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 py-5 text-sm text-slate-400 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-2xl">
              &copy; {currentYear} Tecpify. Una forma mas clara de recibir pedidos,
              compartir tu link y operar mejor el negocio.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {marketingLegalLinks.map((link) => (
                <Link key={link.href} href={link.href} className={marketingLinkClassName}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    );
  }

  const links = [
    { label: "Landing", href: "/" },
    ...(businessSlug
      ? [
          { label: "Dashboard", href: `/dashboard/${businessSlug}` },
          { label: "Pedidos", href: `/pedidos/${businessSlug}` },
          { label: "Metricas", href: `/metricas/${businessSlug}` },
        ]
      : []),
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
              Operacion y visibilidad ligera para negocios en crecimiento.
            </h2>
            <p className="mt-2 text-sm leading-6 text-brand-text-muted">
              MVP enfocado en pequenos negocios que necesitan una forma mas simple de
              recibir pedidos y organizar su operacion.
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
