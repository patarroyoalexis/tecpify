import type { ReactNode } from "react";

import { StorefrontOrderWizard } from "@/components/storefront/order-wizard";
import { getBusinessBySlugWithProducts } from "@/data/businesses";

function StorefrontMessage({
  tone,
  eyebrow,
  title,
  description,
}: {
  tone: "rose" | "amber";
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
        <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p
            className={`text-sm font-semibold uppercase tracking-[0.24em] ${
              tone === "rose" ? "text-rose-500" : "text-amber-600"
            }`}
          >
            {eyebrow}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{title}</p>
          <div className="mt-3 text-sm leading-6 text-slate-600">{description}</div>
        </section>
      </div>
    </main>
  );
}

export default async function StorefrontOrderPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  let business = null;

  try {
    const result = await getBusinessBySlugWithProducts(negocioId);

    if (result.status === "ok" || result.status === "no_products") {
      business = result.business;
    } else {
      business = null;
    }
  } catch {
    business = null;
  }

  if (!business) {
    return (
      <StorefrontMessage
        tone="rose"
        eyebrow="Link no disponible"
        title="Negocio no encontrado"
        description={
          <>
            Este enlace no corresponde a un negocio real disponible. Verifica el link o
            solicita uno nuevo.
          </>
        }
      />
    );
  }

  if (business.products.length === 0) {
    return (
      <StorefrontMessage
        tone="amber"
        eyebrow="Catalogo no disponible"
        title="Este negocio aun no esta listo para recibir pedidos"
        description={
          <>
            {business.name} ya existe, pero todavia no tiene productos activos para
            recibir pedidos desde este formulario.
          </>
        }
      />
    );
  }

  return (
    <StorefrontOrderWizard
      business={business}
    />
  );
}
