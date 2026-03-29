import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface LandingPageProps {
  isAuthenticated: boolean;
}

const operationalSignals = [
  "Menos desorden en WhatsApp",
  "Catálogo centralizado",
  "Seguimiento claro del pedido",
  "Control operativo desde un sólo lugar",
];

const steps = [
  {
    number: "01",
    title: "Crea tu negocio",
    description: "Activa tu espacio en minutos y deja lista una base clara para operar.",
  },
  {
    number: "02",
    title: "Comparte tu link",
    description: "Muestra tu catálogo con un enlace público fácil de enviar por WhatsApp o redes.",
  },
  {
    number: "03",
    title: "Recibe y organiza pedidos",
    description: "Consulta entradas, seguimiento y estado operativo sin perder conversaciones.",
  },
];

const benefits = [
  {
    title: "La entrada del negocio deja de depender del chat",
    description:
      "Tus clientes siguen llegando por canales familiares, pero los pedidos entran a un flujo mucho más ordenado.",
  },
  {
    title: "Tu catálogo vive en un solo punto",
    description:
      "Productos, disponibilidad y presentación dejan de dispersarse en mensajes, fotos sueltas y respuestas repetidas.",
  },
  {
    title: "Cada pedido tiene trazabilidad básica",
    description:
      "Sabes que entró, en que estado va y qué necesita atención, sin improvisar seguimiento manual.",
  },
];

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const primaryHref = isAuthenticated ? "/dashboard" : "/register?redirectTo=/dashboard";
  const secondaryHref = "#como-funciona";
  const secondaryLabel = "Ver cómo funciona";
  const primaryLabel = isAuthenticated ? "Ir a mi panel" : "Crear mi negocio gratis";

  return (
    <main className="overflow-x-clip">
      <section className="px-3 pb-12 pt-6 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20 lg:pt-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          <div className="relative overflow-hidden rounded-[32px] border border-[#D9E6FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,245,255,0.92))] px-4 py-7 shadow-[0_24px_80px_rgba(18,50,107,0.12)] sm:rounded-[36px] sm:px-8 sm:py-10 lg:px-12 lg:py-14">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(24,181,106,0.14),transparent_42%),radial-gradient(circle_at_top_right,rgba(18,50,107,0.12),transparent_36%)]" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:gap-14">
              <div className="min-w-0 max-w-[39rem]">
                <span className="inline-flex items-center rounded-full border border-[#CFE2FF] bg-white/88 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#294B8F] shadow-[0_8px_30px_rgba(18,50,107,0.08)]">
                  Para negocios que reciben pedidos
                </span>
                <h1 className="mt-5 text-[clamp(2.3rem,10vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[#12326B] lg:text-[3.85rem] xl:text-[4.15rem]">
                  <span className="block text-balance lg:whitespace-nowrap">Organiza tus pedidos.</span>
                  <span className="mt-2 block text-balance lg:whitespace-nowrap">Comparte tu link.</span>
                  <span className="mt-2 block text-balance text-[#18B56A] lg:whitespace-nowrap">
                    Opera sin desorden.
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-8 text-[#294B8F] sm:text-lg">
                  Recibe pedidos en línea, centraliza tu catálogo y lleva el control de todo en un
                  solo lugar.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href={primaryHref}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#18B56A] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(24,181,106,0.28)] transition hover:bg-[#129457] sm:w-auto"
                  >
                    {primaryLabel}
                  </Link>
                  <Link
                    href={secondaryHref}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white/90 px-6 py-3 text-sm font-semibold text-[#12326B] transition hover:border-[#BFD3FF] hover:bg-white sm:w-auto"
                  >
                    {secondaryLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-8 grid gap-3 border-t border-[#D9E6FF] pt-6 sm:grid-cols-2 xl:grid-cols-4">
                  {operationalSignals.map((signal) => (
                    <div key={signal} className="flex items-center gap-2 text-sm text-[#14213D]">
                      <CheckCircle2 className="h-4 w-4 text-[#18B56A]" aria-hidden="true" />
                      <span>{signal}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto min-w-0 w-full max-w-[35rem] lg:max-w-none">
                <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#18B56A]/12 blur-3xl sm:h-64 sm:w-64" />
                <div className="relative w-full max-w-full rounded-[26px] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(238,245,255,0.38))] p-2 shadow-[0_26px_70px_rgba(18,50,107,0.14)] ring-1 ring-[#D9E6FF]/75 sm:rounded-[30px] sm:p-3">
                  <Image
                    src="/images/landing/hero-tecpify-square.png"
                    alt="Vista principal de Tecpify mostrando el flujo del producto para recibir y ordenar pedidos."
                    width={1200}
                    height={1200}
                    priority
                    className="block h-auto max-w-full rounded-[20px] object-cover sm:rounded-[24px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#294B8F]">
              Cómo funciona
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#12326B] sm:text-4xl">
              Un flujo simple para empezar a operar con mas claridad.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#294B8F]">
              Tecpify reduce el caos operativo a tres pasos concretos para que un negocio publique
              rapido, comparta mejor y atienda pedidos con orden desde el primer dia.
            </p>
          </div>

          <div className="relative">
            <div className="absolute bottom-4 left-[1.05rem] top-4 hidden w-px bg-[linear-gradient(180deg,#BFD3FF,#D9E6FF)] md:block" />
            <div className="grid gap-5">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="relative grid gap-4 rounded-[28px] border border-[#D9E6FF] bg-white/80 p-6 shadow-[0_18px_50px_rgba(18,50,107,0.08)] md:grid-cols-[auto_1fr]"
                >
                  <div className="relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#12326B] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,50,107,0.22)]">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#14213D]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#294B8F] sm:text-base">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#294B8F]">
              Beneficios reales
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#12326B] sm:text-4xl">
              Mas control para operar, menos friccion para vender.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#294B8F]">
              No es un dashboard recargado ni una promesa vacia: es una forma mas clara de
              recibir pedidos y sostener la operacion cotidiana.
            </p>
          </div>

          <div className="grid gap-4">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className={`rounded-[30px] border border-[#D9E6FF] px-6 py-6 shadow-[0_16px_44px_rgba(18,50,107,0.08)] ${
                  index === 1
                    ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,245,255,0.92))]"
                    : "bg-white/82"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF5FF] text-sm font-semibold text-[#12326B]">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-[#14213D]">{benefit.title}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#294B8F] sm:text-base">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 pt-8 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[34px] border border-[#D9E6FF] bg-[linear-gradient(135deg,#12326B_0%,#163D83_62%,#1A4A9B_100%)] px-6 py-8 text-white shadow-[0_28px_90px_rgba(18,50,107,0.22)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B9D7FF]">
                Empieza hoy
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Dale a tu negocio una entrada mas clara para vender y operar.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#DCE8FF]">
                Crea tu negocio gratis y empieza a recibir pedidos con una experiencia más
                ordenada, simple y profesional.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#18B56A] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(24,181,106,0.24)] transition hover:bg-[#129457]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/18 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
