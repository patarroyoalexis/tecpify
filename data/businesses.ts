import { supabase } from "@/lib/supabase/client";
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
};

export type BusinessProductsLookupResult =
  | { status: "not_found" }
  | { status: "unmapped"; business: BusinessConfig }
  | { status: "no_products"; business: BusinessConfig }
  | { status: "ok"; business: BusinessConfig };

const isDevelopment = process.env.NODE_ENV !== "production";

function logBusinessDebug(message: string, details: Record<string, unknown>) {
  if (!isDevelopment) {
    return;
  }

  console.info(`[businesses] ${message}`, details);
}

export function getBusinessBySlug(slug: string) {
  return mockBusinesses.find((business) => business.slug === slug) ?? null;
}

export const getBusinessById = getBusinessBySlug;

export async function getBusinessBySlugFromDatabase(slug: string) {
  logBusinessDebug("Resolving business by slug", { slug });

  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle<SupabaseBusinessRow>();

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  logBusinessDebug("Business row resolved from Supabase", {
    slug,
    databaseId: data?.id ?? null,
    found: Boolean(data),
  });

  return data;
}

export async function getBusinessBySlugWithProducts(
  slug: string,
): Promise<BusinessProductsLookupResult> {
  const business = getBusinessBySlug(slug);

  logBusinessDebug("Received storefront slug", { slug, foundInMock: Boolean(business) });

  if (!business) {
    return { status: "not_found" };
  }

  const databaseBusiness = await getBusinessBySlugFromDatabase(slug);
  const businessWithDatabaseId: BusinessConfig = {
    ...business,
    databaseId: databaseBusiness?.id ?? null,
  };

  logBusinessDebug("Resolved business configuration", {
    slug,
    name: businessWithDatabaseId.name,
    databaseId: businessWithDatabaseId.databaseId,
  });

  if (!businessWithDatabaseId.databaseId) {
    return {
      status: "unmapped",
      business: businessWithDatabaseId,
    };
  }

  const { getProductsByBusinessId, mapProductToBusinessProduct } = await import(
    "@/lib/data/products"
  );
  const products = await getProductsByBusinessId(businessWithDatabaseId.databaseId);

  logBusinessDebug("Products query completed", {
    slug,
    databaseId: businessWithDatabaseId.databaseId,
    productsCount: products.length,
  });

  if (products.length === 0) {
    return {
      status: "no_products",
      business: {
        ...businessWithDatabaseId,
        products: [],
      },
    };
  }

  return {
    status: "ok",
    business: {
      ...businessWithDatabaseId,
      products: products.map(mapProductToBusinessProduct),
    },
  };
}

export async function getBusinessByIdWithProducts(businessId: string) {
  return getBusinessBySlugWithProducts(businessId);
}
