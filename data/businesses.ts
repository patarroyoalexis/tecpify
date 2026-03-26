import { debugError, debugLog } from "@/lib/debug";
import { hasVerifiedBusinessOwner } from "@/lib/auth/business-access";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import { listCurrentUserLegacyBusinessOwnershipRemediations } from "@/lib/data/business-ownership-remediation";
import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
} from "@/lib/supabase/server";
import { DELIVERY_TYPES, PAYMENT_METHODS } from "@/types/orders";
import type {
  BusinessRecord,
  LegacyBusinessOwnershipRemediationRecord,
} from "@/types/businesses";
import type { BusinessConfig } from "@/types/storefront";

type PublicSupabaseBusinessRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

type AuthenticatedSupabaseBusinessRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

export interface HomeBusinessesSnapshot {
  realBusinesses: BusinessConfig[];
  legacyOwnershipRemediations: LegacyBusinessOwnershipRemediationRecord[];
}

export type BusinessProductsLookupResult =
  | { status: "not_found" }
  | { status: "no_products"; business: BusinessConfig }
  | { status: "ok"; business: BusinessConfig };

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapSupabaseBusinessRow(
  row: PublicSupabaseBusinessRow | AuthenticatedSupabaseBusinessRow,
): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: "created_by_user_id" in row ? row.created_by_user_id : null,
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

function mapDatabaseBusinessToConfig(databaseBusiness: BusinessRecord): BusinessConfig {
  return withDatabaseId(
    createBaseBusinessConfig(databaseBusiness.slug, {
      name: databaseBusiness.name,
    }),
    databaseBusiness.id,
  );
}

export async function getBusinessBySlugFromDatabase(slug: string) {
  const normalizedSlug = normalizeBusinessSlug(slug);
  debugLog("[businesses] Resolving business by slug", { slug });

  const supabase = createServerSupabasePublicClient();
  const { data, error } = await supabase.rpc("get_storefront_business_by_slug", {
    requested_slug: normalizedSlug,
  });

  if (error) {
    debugError("[businesses] Failed to resolve business", { slug });
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  const storefrontBusiness = Array.isArray(data)
    ? ((data[0] as PublicSupabaseBusinessRow | undefined) ?? null)
    : null;

  debugLog("[businesses] Business resolved", {
    slug: normalizedSlug,
    found: Boolean(storefrontBusiness),
  });

  return storefrontBusiness ? mapSupabaseBusinessRow(storefrontBusiness) : null;
}

interface BusinessProductsLookupDependencies {
  getBusinessBySlugFromDatabase: typeof getBusinessBySlugFromDatabase;
  getProductsByBusinessId: (businessId: string) => Promise<
    Awaited<ReturnType<typeof import("@/lib/data/products").getProductsByBusinessId>>
  >;
  mapProductToBusinessProduct: typeof import("@/lib/data/products").mapProductToBusinessProduct;
  debugLog: typeof debugLog;
}

async function getBusinessesFromDatabase() {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_at, updated_at, created_by_user_id")
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return ((data ?? []) as AuthenticatedSupabaseBusinessRow[]).map(mapSupabaseBusinessRow);
}

export async function getHomeBusinesses(
  operatorUserId?: string | null,
): Promise<HomeBusinessesSnapshot> {
  let databaseBusinesses: BusinessRecord[] = [];
  let legacyOwnershipRemediations: LegacyBusinessOwnershipRemediationRecord[] = [];

  try {
    databaseBusinesses = await getBusinessesFromDatabase();
  } catch (error) {
    debugError("[businesses] Failed to list businesses for home", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    legacyOwnershipRemediations = operatorUserId
      ? await listCurrentUserLegacyBusinessOwnershipRemediations()
      : [];
  } catch (error) {
    debugError("[businesses] Failed to load legacy ownership remediations for home", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const accessibleBusinesses = operatorUserId
    ? databaseBusinesses.filter(
        (business) => business.createdByUserId === operatorUserId && hasVerifiedBusinessOwner(business.createdByUserId),
      )
    : [];

  return {
    realBusinesses: accessibleBusinesses.map(mapDatabaseBusinessToConfig),
    legacyOwnershipRemediations,
  };
}

export function createGetBusinessBySlugWithProducts(
  dependencies?: Partial<BusinessProductsLookupDependencies>,
) {
  return async function getBusinessBySlugWithProducts(
    slug: string,
  ): Promise<BusinessProductsLookupResult> {
    const databaseBusiness = await (
      dependencies?.getBusinessBySlugFromDatabase ?? getBusinessBySlugFromDatabase
    )(slug);

    (dependencies?.debugLog ?? debugLog)("[businesses] Received storefront slug", {
      slug,
      resolved: Boolean(databaseBusiness),
    });

    if (!databaseBusiness || !hasVerifiedBusinessOwner(databaseBusiness.createdByUserId)) {
      return { status: "not_found" };
    }

    const business = mapDatabaseBusinessToConfig(databaseBusiness);
    let getProductsByBusinessId = dependencies?.getProductsByBusinessId;
    let mapProductToBusinessProduct = dependencies?.mapProductToBusinessProduct;

    if (!getProductsByBusinessId || !mapProductToBusinessProduct) {
      const productsModule = await import("@/lib/data/products");
      getProductsByBusinessId ??= productsModule.getProductsByBusinessId;
      mapProductToBusinessProduct ??= productsModule.mapProductToBusinessProduct;
    }

    const products = await getProductsByBusinessId(databaseBusiness.id);

    (dependencies?.debugLog ?? debugLog)("[businesses] Products query completed", {
      slug,
      productsCount: products.length,
    });

    if (products.length === 0) {
      return {
        status: "no_products",
        business: {
          ...business,
          products: [],
        },
      };
    }

    return {
      status: "ok",
      business: {
        ...business,
        products: products.map(mapProductToBusinessProduct),
      },
    };
  };
}

export const getBusinessBySlugWithProducts = createGetBusinessBySlugWithProducts();

export async function getBusinessByIdWithProducts(businessId: string) {
  return getBusinessBySlugWithProducts(businessId);
}
