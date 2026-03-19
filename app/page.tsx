import Link from "next/link";

import { CreateBusinessPanel } from "@/components/home/create-business-panel";
import { getHomeBusinesses } from "@/data/businesses";

function BusinessCard({
  business,
  badge,
  tone = "default",
}: {
  business: {
    slug: string;
    name: string;
    tagline: string;
    accent: string;
  };
  badge: string;
  tone?: "default" | "demo";
}) {
  return (
    <article
      className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
        tone === "demo"
          ? "border-amber-200 bg-amber-50/70"
          : "border-white/70 bg-white/90"
      }`}
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
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Tecpify MVP
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Flujo real del MVP
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Crea un negocio real, cargale catalogo y usalo para recibir pedidos reales.
              Los escenarios demo siguen disponibles, pero quedan aparte para no mezclar la
              validacion operativa con ejemplos de muestra.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                {realBusinesses.length} negocio{realBusinesses.length === 1 ? "" : "s"} real
                {realBusinesses.length === 1 ? "" : "es"}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                {demoBusinesses.length} demo{demoBusinesses.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <CreateBusinessPanel />
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Operacion real
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Negocios conectados a Supabase
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Este es el bloque principal para validar el MVP con negocios operativos.
                  Desde aqui se crean, se abren y se gestionan los negocios reales.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700">
                {realBusinesses.length} real{realBusinesses.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-slate-950">Negocios reales</h3>
              <p className="mt-1 text-sm text-slate-600">
                Slugs resueltos desde la tabla `businesses` y listos para operar con datos
                persistidos.
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
              Aun no hay negocios reales visibles en este entorno. Crea uno nuevo para
              empezar el flujo real del MVP.
            </div>
          )}
        </section>

        {demoBusinesses.length > 0 ? (
          <section className="space-y-4 rounded-[28px] border border-amber-200/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Soporte demo
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Escenarios de muestra
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Siguen disponibles para pruebas locales, QA y showcase, pero no forman
                  parte del flujo operativo real.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                {demoBusinesses.length}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {demoBusinesses.map((business) => (
                <BusinessCard
                  key={business.slug}
                  business={business}
                  badge="Demo"
                  tone="demo"
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
