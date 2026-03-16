import Link from "next/link";

import { mockBusinesses } from "@/data/businesses";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Tecpify demo
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Negocios disponibles
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Cada negocio tiene su propio formulario publico y su propio dashboard
            privado. Los pedidos quedan aislados por negocio para evitar cualquier cruce.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {mockBusinesses.map((business) => (
            <article
              key={business.slug}
              className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
            >
              <div className={`rounded-[24px] bg-gradient-to-r ${business.accent} p-5`}>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">
                  {business.slug}
                </p>
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
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold transition hover:bg-slate-800"
                  style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
                >
                  Abrir formulario publico
                </Link>
                <Link
                  href={`/dashboard/${business.slug}`}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Abrir dashboard privado
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
