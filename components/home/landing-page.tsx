import Link from "next/link";

interface LandingPageProps {
  isAuthenticated: boolean;
}

const benefits = [
  {
    title: "Link publico por negocio",
    description: "Cada negocio comparte su propio enlace para empezar a recibir pedidos sin friccion.",
  },
  {
    title: "Pedidos centralizados",
    description: "La operacion diaria queda ordenada en un solo espacio para revisar y avanzar estados.",
  },
  {
    title: "Operacion mas clara",
    description: "Catalogo, pedidos y seguimiento basico conviven con el mismo lenguaje visual del MVP.",
  },
  {
    title: "Metricas para empezar",
    description: "Visualiza senales basicas del negocio sin depender de una capa analitica compleja.",
  },
];

const steps = [
  "Crea tu negocio y activa tu espacio operativo.",
  "Carga un catalogo basico con productos disponibles.",
  "Comparte tu link publico con clientes.",
  "Recibe y gestiona pedidos desde el dashboard.",
];

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const primaryHref = isAuthenticated ? "/dashboard" : "/register?redirectTo=/dashboard";
  const secondaryHref = isAuthenticated ? "/dashboard" : "/login?redirectTo=/dashboard";

  return (
    <main>
      <section className="px-4 pb-10 pt-8 sm:px-6 lg:px-5">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Tecpify para pequenos negocios
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Recibe y gestiona pedidos de tu negocio en un solo lugar.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Publica un catalogo simple, comparte tu link y organiza la operacion diaria con una
              capa privada enfocada en pedidos, seguimiento y visibilidad inicial.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {isAuthenticated ? "Ir al dashboard" : "Crear cuenta"}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {isAuthenticated ? "Abrir espacio operativo" : "Iniciar sesion"}
              </Link>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              Pensado para negocios que necesitan validar rapido su flujo de pedidos antes de
              crecer a una operacion mas compleja.
            </p>
          </div>

          <aside className="rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              Pensado para empezar simple
            </p>
            <div className="mt-5 grid gap-4">
              <article className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
                <p className="text-sm font-semibold text-slate-950">Catalogo y link publico</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cada negocio puede compartir un formulario propio para recibir pedidos desde su
                  canal mas cercano.
                </p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-sm font-semibold text-slate-950">Operacion privada</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  El equipo entra a una capa autenticada para revisar pedidos, productos y senales
                  basicas del negocio.
                </p>
              </article>
              <article className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-5">
                <p className="text-sm font-semibold text-slate-950">Base lista para crecer</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  La estructura separa captacion y operacion para que el siguiente refactor sea mas
                  ordenado y mantenible.
                </p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section id="como-funciona" className="px-4 py-8 sm:px-6 lg:px-5">
        <div className="mx-auto w-full max-w-7xl rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Un flujo corto para salir a operar rapido
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Tecpify organiza lo esencial del MVP para que un negocio pueda publicar, recibir y
              atender pedidos sin perder tiempo en configuraciones innecesarias.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step}
                className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Paso {index + 1}
                </p>
                <p className="mt-3 text-base font-semibold text-slate-950">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="beneficios" className="px-4 py-8 sm:px-6 lg:px-5">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Beneficios
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Lo que necesita un negocio pequeno para arrancar
            </h2>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
              >
                <h3 className="text-xl font-semibold text-slate-950">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 pt-8 sm:px-6 lg:px-5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
              Empieza hoy
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Deja clara la entrada al producto y centraliza la operacion.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Crea tu cuenta para abrir el espacio operativo o entra si ya tienes acceso.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:min-w-[240px]">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {isAuthenticated ? "Ir al dashboard" : "Crear cuenta"}
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {isAuthenticated ? "Ver negocios" : "Iniciar sesion"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
