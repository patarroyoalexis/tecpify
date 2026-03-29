import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";

export const metadata: Metadata = {
  title: "Términos | Tecpify",
  description: "Resumen público de términos de uso para la experiencia operativa de Tecpify.",
};

const termsSections = [
  {
    title: "Uso del producto",
    body: "Tecpify ofrece una base operativa para publicar un negocio, compartir un enlace y recibir pedidos. El uso del producto debe respetar el flujo real disponible en runtime y no asumir funciones no expuestas por la aplicación.",
  },
  {
    title: "Responsabilidad de los negocios",
    body: "Cada negocio es responsable de mantener su catalogo, instrucciones operativas, medios de pago habilitados y seguimiento de pedidos con informacion real y actualizada dentro de su propio espacio.",
  },
  {
    title: "Pedidos y contacto",
    body: "Los pedidos enviados por clientes a traves de Tecpify deben corresponder a operaciones legítimas del negocio. El producto sólo expone la informacion necesaria para que el negocio gestione el pedido y su comunicación operativa.",
  },
  {
    title: "Disponibilidad y cambios",
    body: "Tecpify puede ajustar superficies públicas y operativas del MVP para mantener consistencia entre runtime, base de datos, pruebas y documentación. La continuidad de uso depende de esa alineación técnica y de configuraciones válidas del entorno.",
  },
];

export default function TermsPage() {
  return (
    <PublicLayoutShell>
      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto w-full max-w-4xl">
          <section className="overflow-hidden rounded-[32px] border border-[#D9E6FF] bg-white/88 shadow-[0_24px_70px_rgba(18,50,107,0.1)]">
            <div className="border-b border-[#D9E6FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,245,255,0.92))] px-6 py-8 sm:px-8 sm:py-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#294B8F]">
                Legal
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#12326B] sm:text-[2.35rem]">
                Términos de uso
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#294B8F] sm:text-base">
                Resumen público del uso esperado de Tecpify como herramienta para recibir pedidos,
                compartir un link y operar mejor el negocio.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex text-sm font-semibold text-[#12326B] underline-offset-4 transition hover:text-[#18B56A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.52)]"
              >
                Volver al inicio
              </Link>
            </div>

            <div className="grid gap-6 px-6 py-8 sm:px-8 sm:py-10">
              {termsSections.map((section) => (
                <article key={section.title} className="rounded-[24px] border border-[#D9E6FF] bg-white/80 p-5 sm:p-6">
                  <h2 className="text-xl font-semibold text-[#14213D]">{section.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#294B8F] sm:text-base">
                    {section.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </PublicLayoutShell>
  );
}
