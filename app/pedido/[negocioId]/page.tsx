import type { ReactNode } from "react";

import { StorefrontOrderWizard } from "@/components/storefront/order-wizard";
import {
  getBusinessBySlug,
  getBusinessBySlugWithProducts,
} from "@/data/businesses";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import type { Order } from "@/types/orders";

function StorefrontMessage({
  tone,
  title,
  description,
}: {
  tone: "rose" | "amber";
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
            {title}
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
  const fallbackBusiness = getBusinessBySlug(negocioId);

  if (!fallbackBusiness) {
    return (
      <StorefrontMessage
        tone="rose"
        title="Negocio no encontrado"
        description={
          <>
            Este link no corresponde a una tienda activa en la demo. Verifica el
            enlace o solicita uno nuevo al negocio.
          </>
        }
      />
    );
  }

  let business = null;
  let productsLoadFailed = false;
  let recentOrders: Order[] = [];

  try {
    const result = await getBusinessBySlugWithProducts(negocioId);

    if (result.status === "ok" || result.status === "no_products" || result.status === "unmapped") {
      business = result.business;
    } else {
      business = null;
    }
  } catch {
    productsLoadFailed = true;
  }

  if (productsLoadFailed) {
    return (
      <StorefrontMessage
        tone="rose"
        title="No pudimos cargar los productos"
        description={
          <>
            Hubo un problema consultando el catalogo real de {fallbackBusiness.name}.
            Verifica las variables de entorno, la tabla <code>products</code> y las
            politicas de lectura en Supabase.
          </>
        }
      />
    );
  }

  if (business && business.databaseId === null) {
    return (
      <StorefrontMessage
        tone="amber"
        title="Negocio pendiente de sincronizacion"
        description={
          <>
            {fallbackBusiness.name} existe en la demo, pero todavia no tiene un UUID
            publico resuelto desde la tabla <code>businesses</code>. Cuando el slug
            quede asociado a un registro visible en Supabase, el catalogo real cargara
            automaticamente.
          </>
        }
      />
    );
  }

  if (!business || business.products.length === 0) {
    return (
      <StorefrontMessage
        tone="amber"
        title="Aun no hay productos disponibles"
        description={
          <>
            {fallbackBusiness.name} todavia no tiene productos activos en este
            formulario. Intenta de nuevo mas tarde o solicita apoyo al negocio.
          </>
        }
      />
    );
  }

  if (business.databaseId) {
    try {
      recentOrders = await getOrdersByBusinessSlugFromDatabase(negocioId);
    } catch {
      recentOrders = [];
    }
  }

  return <StorefrontOrderWizard business={business} recentOrders={recentOrders} />;
}
