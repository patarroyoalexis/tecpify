import type { ReactNode } from "react";

import { StorefrontOrderWizard } from "@/components/storefront/order-wizard";
import {
  getBusinessBySlugWithProducts,
  resolveBusinessBySlug,
} from "@/data/businesses";
import { getAdminProductsByBusinessId } from "@/lib/data/products";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import type { Order } from "@/types/orders";

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
  searchParams,
}: {
  params: Promise<{ negocioId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { negocioId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const isTestMode = resolvedSearchParams.mode === "test-order";
  const resolvedBusiness = await resolveBusinessBySlug(negocioId).catch(() => null);
  const fallbackBusiness = resolvedBusiness?.business ?? null;

  if (!fallbackBusiness) {
    return (
      <StorefrontMessage
        tone="rose"
        eyebrow="Link no disponible"
        title="Negocio no encontrado"
        description={
          <>
            Este enlace no corresponde a un negocio disponible. Verifica el link o
            solicita uno nuevo.
          </>
        }
      />
    );
  }

  let business = null;
  let recentOrders: Order[] = [];
  let totalProducts = 0;
  let activeProducts = 0;

  try {
    const result = await getBusinessBySlugWithProducts(negocioId);

    if (result.status === "ok" || result.status === "no_products" || result.status === "unmapped") {
      business = result.business;
      activeProducts = result.status === "ok" ? result.business.products.length : 0;
    } else {
      business = null;
    }
  } catch {
    business = null;
  }

  if (business && business.databaseId === null) {
    return (
      <StorefrontMessage
        tone="amber"
        eyebrow="Catalogo no disponible"
        title="Este negocio aun no esta listo para recibir pedidos"
        description={
          <>
            {fallbackBusiness.name} todavia no tiene un catalogo publico disponible.
            Intenta de nuevo mas tarde o solicita al negocio su link activo.
          </>
        }
      />
    );
  }

  if (business?.databaseId) {
    try {
      const adminProducts = await getAdminProductsByBusinessId(business.databaseId);
      totalProducts = adminProducts.length;
      activeProducts = adminProducts.filter((product) => product.is_available).length;
    } catch {
      return (
        <StorefrontMessage
          tone="amber"
          eyebrow="Catalogo no disponible"
          title="Este catalogo no se pudo cargar en este momento"
          description={
            <>
              {fallbackBusiness.name} no tiene su catalogo disponible por ahora. Intenta
              de nuevo en unos minutos.
            </>
          }
        />
      );
    }
  }

  if (!business) {
    return (
      <StorefrontMessage
        tone="amber"
        eyebrow="Catalogo no disponible"
        title="Este negocio aun no tiene catalogo disponible"
        description={
          <>
            {fallbackBusiness.name} todavia no tiene productos disponibles para pedir
            desde este link.
          </>
        }
      />
    );
  }

  if (totalProducts === 0) {
    return (
      <StorefrontMessage
        tone="amber"
        eyebrow="Catalogo vacio"
        title="Este negocio aun no ha cargado productos"
        description={
          <>
            {fallbackBusiness.name} ya existe, pero todavia no publico su catalogo.
            Vuelve mas tarde cuando termine de cargar sus primeros productos.
          </>
        }
      />
    );
  }

  if (activeProducts === 0) {
    return (
      <StorefrontMessage
        tone="amber"
        eyebrow="Catalogo en preparacion"
        title="Este negocio aun no tiene productos disponibles"
        description={
          <>
            {fallbackBusiness.name} ya cargo productos, pero todavia no activo ninguno
            para recibir pedidos desde este formulario.
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

  return (
    <StorefrontOrderWizard
      business={business}
      recentOrders={recentOrders}
      isTestMode={isTestMode}
    />
  );
}
