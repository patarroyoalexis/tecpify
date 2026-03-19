import Link from "next/link";

import { getHomeBusinesses } from "@/data/businesses";

function BusinessCard({
  business,
  badge,
}: {
  business: {
    slug: string;
    name: string;
    tagline: string;
    accent: string;
  };
  badge: string;
}) {
  return (
    <article
      key={business.slug}
      className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
    >
      <div className={`rounded-[24px] bg-gradient-to-r ${business.accent} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
            {business.slug}
          </p>
          <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            {badge}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          {business.name}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {business.tagline}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/pedido/${business.slug}`}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Abrir formulario publico
        </Link>
        <Link
          href={`/dashboard/${business.slug}`}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Abrir dashboard
        </Link>
        <Link
          href={`/pedidos/${business.slug}`}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Ir a pedidos
        </Link>
        <Link
          href={`/metricas/${business.slug}`}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Ver metricas
        </Link>
      </div>
    </article>
  );
}

export default async function Home() {
  const { realBusinesses, demoBusinesses } = await getHomeBusinesses();

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Tecpify MVP
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Negocios disponibles
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            La home ahora separa negocios conectados a la base real de escenarios
            demo. Asi evitamos mezclar onboarding ficticio con operacion persistida.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Negocios reales</h2>
              <p className="mt-1 text-sm text-slate-600">
                Slugs resueltos desde la tabla `businesses` y listos para operar con datos persistidos.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {realBusinesses.length}
            </span>
          </div>

          {realBusinesses.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {realBusinesses.map((business) => (
                <BusinessCard key={business.slug} business={business} badge="Real" />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
              Aun no hay negocios reales visibles desde la base de datos en este entorno.
            </div>
          )}
        </section>

        {demoBusinesses.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Escenarios demo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Slugs y negocios mockeados que siguen disponibles solo para pruebas locales y UX.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                {demoBusinesses.length}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {demoBusinesses.map((business) => (
                <BusinessCard key={business.slug} business={business} badge="Demo" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
