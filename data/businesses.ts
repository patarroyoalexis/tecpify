import { debugError, debugLog } from "@/lib/debug";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DELIVERY_TYPES, PAYMENT_METHODS } from "@/types/orders";
import type { BusinessRecord } from "@/types/businesses";
import type { BusinessConfig } from "@/types/storefront";

export const mockBusinesses: BusinessConfig[] = [
  {
    slug: "panaderia-estacion",
    databaseId: null,
    name: "Panaderia La Estacion",
    tagline: "Pedidos rapidos para clientes frecuentes y ventas por WhatsApp.",
    accent: "from-amber-300 via-orange-200 to-rose-100",
    availablePaymentMethods: [
      "Transferencia",
      "Tarjeta",
      "Nequi",
      "Contra entrega",
    ],
    availableDeliveryTypes: ["domicilio", "recogida en tienda"],
    products: [
      {
        id: "brownies",
        name: "Caja de brownies",
        description: "Caja surtida de brownies artesanales.",
        price: 18500,
      },
      {
        id: "cafe-500",
        name: "Cafe molido 500 g",
        description: "Tueste medio para casa u oficina.",
        price: 31500,
      },
      {
        id: "croissant-pack",
        name: "Pack de croissants",
        description: "Seis croissants de mantequilla recien horneados.",
        price: 22000,
      },
    ],
  },
  {
    slug: "cafe-aura",
    databaseId: null,
    name: "Cafe Aura",
    tagline: "Accesorios y consumibles listos para recoger o enviar.",
    accent: "from-sky-200 via-cyan-100 to-white",
    availablePaymentMethods: ["Transferencia", "Tarjeta", "Nequi", "Efectivo"],
    availableDeliveryTypes: ["domicilio", "recogida en tienda"],
    products: [
      {
        id: "vasos-12oz",
        name: "Vasos biodegradables 12 oz",
        description: "Pack de 50 unidades para bebidas frias o calientes.",
        price: 9600,
      },
      {
        id: "pitillos-bambu",
        name: "Pitillos de bambu",
        description: "Juego reutilizable con cepillo limpiador.",
        price: 14500,
      },
      {
        id: "servilletas",
        name: "Servilletas premium",
        description: "Paquete absorbente para barra o takeaway.",
        price: 12800,
      },
    ],
  },
];

type SupabaseBusinessRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export interface ResolvedBusiness {
  business: BusinessConfig;
  source: "database" | "demo";
  hasDatabaseRecord: boolean;
}

export interface OperationalBusinessResolution {
  business: BusinessConfig;
  source: "database";
  hasDatabaseRecord: true;
}

export interface HomeBusinessesSnapshot {
  realBusinesses: BusinessConfig[];
  demoBusinesses: BusinessConfig[];
}

export type BusinessProductsLookupResult =
  | { status: "not_found" }
  | { status: "unmapped"; business: BusinessConfig }
  | { status: "no_products"; business: BusinessConfig }
  | { status: "ok"; business: BusinessConfig };

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapSupabaseBusinessRow(row: SupabaseBusinessRow): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createBaseBusinessConfig(
  slug: string,
  overrides?: Partial<BusinessConfig>,
): BusinessConfig {
  return {
    slug,
    databaseId: overrides?.databaseId ?? null,
    name: overrides?.name ?? humanizeSlug(slug),
    tagline:
      overrides?.tagline ??
      "Negocio operativo conectado a la base principal de Tecpify.",
    accent: overrides?.accent ?? "from-slate-200 via-slate-100 to-white",
    availablePaymentMethods: overrides?.availablePaymentMethods ?? [...PAYMENT_METHODS],
    availableDeliveryTypes: overrides?.availableDeliveryTypes ?? [...DELIVERY_TYPES],
    products: overrides?.products ?? [],
  };
}

function withDatabaseId(
  business: BusinessConfig,
  databaseId: string | null,
): BusinessConfig {
  return {
    ...business,
    databaseId,
  };
}

export function getDemoBusinessBySlug(slug: string) {
  return mockBusinesses.find((business) => business.slug === slug) ?? null;
}

export const getBusinessBySlug = getDemoBusinessBySlug;
export const getBusinessById = getDemoBusinessBySlug;

export async function getBusinessBySlugFromDatabase(slug: string) {
  const normalizedSlug = normalizeBusinessSlug(slug);
  debugLog("[businesses] Resolving business by slug", { slug });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_at, updated_at")
    .eq("slug", normalizedSlug)
    .maybeSingle<SupabaseBusinessRow>();

  if (error) {
    debugError("[businesses] Failed to resolve business", { slug });
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  debugLog("[businesses] Business resolved", {
    slug: normalizedSlug,
    found: Boolean(data),
  });

  return data ? mapSupabaseBusinessRow(data) : null;
}

async function getBusinessesFromDatabase() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_at, updated_at")
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return ((data ?? []) as SupabaseBusinessRow[]).map(mapSupabaseBusinessRow);
}

export async function resolveBusinessBySlug(slug: string): Promise<ResolvedBusiness | null> {
  const normalizedSlug = normalizeBusinessSlug(slug);
  const demoBusiness = getDemoBusinessBySlug(normalizedSlug);
  const databaseBusiness = await getBusinessBySlugFromDatabase(slug);

  if (!databaseBusiness && !demoBusiness) {
    return null;
  }

  if (databaseBusiness) {
    return {
      business: withDatabaseId(
        demoBusiness
          ? demoBusiness
          : createBaseBusinessConfig(databaseBusiness.slug, { name: databaseBusiness.name }),
        databaseBusiness.id,
      ),
      source: "database",
      hasDatabaseRecord: true,
    };
  }

  return {
    business: withDatabaseId(demoBusiness!, null),
    source: "demo",
    hasDatabaseRecord: false,
  };
}

export async function resolveOperationalBusinessBySlug(
  slug: string,
): Promise<OperationalBusinessResolution | null> {
  const resolvedBusiness = await resolveBusinessBySlug(slug);

  if (!resolvedBusiness) {
    return null;
  }

  if (resolvedBusiness.source !== "database") {
    return null;
  }

  return {
    business: resolvedBusiness.business,
    source: resolvedBusiness.source,
    hasDatabaseRecord: resolvedBusiness.hasDatabaseRecord,
  };
}

export async function getHomeBusinesses(): Promise<HomeBusinessesSnapshot> {
  let databaseBusinesses: BusinessRecord[] = [];

  try {
    databaseBusinesses = await getBusinessesFromDatabase();
  } catch (error) {
    debugError("[businesses] Failed to list businesses for home", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const realBusinesses = databaseBusinesses.map((databaseBusiness) => {
    const demoBusiness = getDemoBusinessBySlug(databaseBusiness.slug);

    return withDatabaseId(
      demoBusiness
        ? demoBusiness
        : createBaseBusinessConfig(databaseBusiness.slug, { name: databaseBusiness.name }),
      databaseBusiness.id,
    );
  });

  const databaseSlugs = new Set(realBusinesses.map((business) => business.slug));
  const demoBusinesses = mockBusinesses.filter((business) => !databaseSlugs.has(business.slug));

  return {
    realBusinesses,
    demoBusinesses,
  };
}

export async function getBusinessBySlugWithProducts(
  slug: string,
): Promise<BusinessProductsLookupResult> {
  const resolvedBusiness = await resolveBusinessBySlug(slug);

  debugLog("[businesses] Received storefront slug", {
    slug,
    resolved: Boolean(resolvedBusiness),
    source: resolvedBusiness?.source ?? null,
  });

  if (!resolvedBusiness) {
    return { status: "not_found" };
  }

  if (!resolvedBusiness.hasDatabaseRecord || !resolvedBusiness.business.databaseId) {
    return {
      status: "unmapped",
      business: resolvedBusiness.business,
    };
  }

  const { getProductsByBusinessId, mapProductToBusinessProduct } = await import(
    "@/lib/data/products"
  );
  const products = await getProductsByBusinessId(resolvedBusiness.business.databaseId);

  debugLog("[businesses] Products query completed", {
    slug,
    productsCount: products.length,
  });

  if (products.length === 0) {
    return {
      status: "no_products",
      business: {
        ...resolvedBusiness.business,
        products: [],
      },
    };
  }

  return {
    status: "ok",
    business: {
      ...resolvedBusiness.business,
      products: products.map(mapProductToBusinessProduct),
    },
  };
}

export async function getBusinessByIdWithProducts(businessId: string) {
  return getBusinessBySlugWithProducts(businessId);
}
