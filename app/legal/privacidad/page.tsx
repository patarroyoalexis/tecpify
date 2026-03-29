import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";

export const metadata: Metadata = {
  title: "Privacidad | Tecpify",
  description: "Resumen público del tratamiento de datos para pedidos y operación en Tecpify.",
};

const privacySections = [
  {
    title: "Datos que se usan",
    body: "Tecpify procesa la información mínima necesaria para que un negocio reciba y gestione pedidos, incluyendo datos de contacto, dirección de entrega cuando aplica, productos seleccionados y notas operativas asociadas al pedido.",
  },
  {
    title: "Finalidad operativa",
    body: "Estos datos se usan para registrar el pedido, permitir seguimiento por parte del negocio y facilitar confirmaciones o contacto por WhatsApp cuando hace falta completar la operación.",
  },
  {
    title: "Responsabilidad del negocio",
    body: "Cada negocio que opera en Tecpify es responsable de usar la información de sus clientes sólo para gestionar pedidos y atención relacionada con ese flujo, sin reutilizarla para fines ajenos sin la autorización correspondiente.",
  },
  {
    title: "Consultas",
    body: "Si necesitas una aclaración sobre el uso de datos en un pedido realizado a traves de Tecpify, contacta primero al negocio que recibió tu orden. Para consultas generales del producto puedes volver al inicio y usar los canales operativos disponibles.",
  },
];

export default function PrivacyPage() {
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
                Política de privacidad
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#294B8F] sm:text-base">
                Resumen público y operativo de como Tecpify participa en el tratamiento de datos
                ligados a pedidos y gestión de negocios dentro del MVP.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex text-sm font-semibold text-[#12326B] underline-offset-4 transition hover:text-[#18B56A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.52)]"
              >
                Volver al inicio
              </Link>
            </div>

            <div className="grid gap-6 px-6 py-8 sm:px-8 sm:py-10">
              {privacySections.map((section) => (
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
