import { debugError, debugLog } from "@/lib/debug";
import { hasVerifiedBusinessOwner } from "@/lib/auth/business-access";
import { requireBusinessSlug } from "@/lib/businesses/slug";
import { getPublicPaymentMethodsForBusiness } from "@/lib/businesses/payment-settings";
import type { BusinessId } from "@/types/identifiers";
import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
} from "@/lib/supabase/server";
import { DELIVERY_TYPES } from "@/types/orders";
import { requireBusinessId } from "@/types/identifiers";
import type {
  BusinessRecord,
  OwnedBusinessSummary,
} from "@/types/businesses";
import type { BusinessConfig } from "@/types/storefront";

type PublicSupabaseBusinessRow = {
  id: string;
  slug: string;
  name: string;
  business_type?: string | null;
  transfer_instructions?: string | null;
  accepts_cash?: boolean | null;
  accepts_transfer?: boolean | null;
  accepts_card?: boolean | null;
  is_active?: boolean | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
};

type AuthenticatedSupabaseBusinessRow = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  transfer_instructions: string | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  accepts_card: boolean | null;
  allows_fiado: boolean | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

type OwnedBusinessSummaryRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  updated_at: string;
  created_by_user_id: string;
};

export interface HomeBusinessesSnapshot {
  realBusinesses: BusinessConfig[];
  unsupportedLegacyBusinessesCount: number;
}

export interface StorefrontBusinessLookupResult {
  business: BusinessRecord | null;
  ownershipVerified: boolean;
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
    businessId: requireBusinessId(row.id),
    businessSlug: requireBusinessSlug(row.slug),
    name: row.name,
    businessType:
      "business_type" in row && typeof row.business_type === "string"
        ? row.business_type
        : null,
    transferInstructions:
      "transfer_instructions" in row && typeof row.transfer_instructions === "string"
        ? row.transfer_instructions
        : null,
    acceptsCash:
      "accepts_cash" in row && typeof row.accepts_cash === "boolean"
        ? row.accepts_cash
        : true,
    acceptsTransfer:
      "accepts_transfer" in row && typeof row.accepts_transfer === "boolean"
        ? row.accepts_transfer
        : true,
    acceptsCard:
      "accepts_card" in row && typeof row.accepts_card === "boolean"
        ? row.accepts_card
        : true,
    allowsFiado:
      "allows_fiado" in row && typeof row.allows_fiado === "boolean"
        ? row.allows_fiado
        : false,
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId:
      "created_by_user_id" in row && typeof row.created_by_user_id === "string"
        ? row.created_by_user_id
        : null,
  };
}

function createBaseBusinessConfig(
  businessSlug: BusinessConfig["businessSlug"],
  overrides?: Partial<BusinessConfig>,
): BusinessConfig {
  return {
    businessSlug,
    businessId: overrides?.businessId ?? null,
    name: overrides?.name ?? humanizeSlug(businessSlug),
    tagline:
      overrides?.tagline ??
      "Ahora hacer tu pedido es más simple.",
    accent: overrides?.accent ?? "from-slate-200 via-slate-100 to-white",
    availablePaymentMethods: overrides?.availablePaymentMethods ?? [],
    availableDeliveryTypes: overrides?.availableDeliveryTypes ?? [...DELIVERY_TYPES],
    products: overrides?.products ?? [],
  };
}

function withDatabaseId(
  business: BusinessConfig,
  businessId: BusinessConfig["businessId"],
): BusinessConfig {
  return {
    ...business,
    businessId,
  };
}

function mapDatabaseBusinessToConfig(databaseBusiness: BusinessRecord): BusinessConfig {
  return withDatabaseId(
    createBaseBusinessConfig(databaseBusiness.businessSlug, {
      name: databaseBusiness.name,
      availablePaymentMethods: getPublicPaymentMethodsForBusiness(databaseBusiness),
    }),
    databaseBusiness.businessId,
  );
}

function mapOwnedBusinessSummaryRow(row: OwnedBusinessSummaryRow): OwnedBusinessSummary {
  return {
    businessId: requireBusinessId(row.id),
    businessSlug: requireBusinessSlug(row.slug),
    businessName: row.name,
    isActive: row.is_active,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
  };
}

export async function getBusinessBySlugFromDatabase(businessSlug: string) {
  const storefrontLookup = await getStorefrontBusinessLookupBySlug(businessSlug);

  return storefrontLookup.business;
}

export async function getStorefrontBusinessLookupBySlug(
  businessSlug: string,
): Promise<StorefrontBusinessLookupResult> {
  const normalizedBusinessSlug = requireBusinessSlug(businessSlug);
  debugLog("[businesses] Resolving business by slug", { businessSlug: normalizedBusinessSlug });

  const supabase = createServerSupabasePublicClient();
  const { data, error } = await supabase.rpc("get_storefront_business_by_slug", {
    requested_slug: normalizedBusinessSlug,
  });

  if (!error) {
    const storefrontBusiness = Array.isArray(data)
      ? ((data[0] as PublicSupabaseBusinessRow | undefined) ?? null)
      : null;

    if (storefrontBusiness) {
      debugLog("[businesses] Business resolved through storefront rpc", {
        businessSlug: normalizedBusinessSlug,
        found: true,
      });

      const ownershipVerified =
        "created_by_user_id" in storefrontBusiness
          ? hasVerifiedBusinessOwner(storefrontBusiness.created_by_user_id ?? null)
          : true;

      return {
        business: mapSupabaseBusinessRow(storefrontBusiness),
        ownershipVerified,
      };
    }
  } else {
    debugError("[businesses] Storefront rpc lookup failed; using public table fallback", {
      businessSlug: normalizedBusinessSlug,
      message: error.message,
    });
  }

  const fallbackResult = await supabase
    .from("businesses")
    .select(
      "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, is_active, created_at, updated_at, created_by_user_id",
    )
    .eq("slug", normalizedBusinessSlug)
    .eq("is_active", true)
    .maybeSingle<PublicSupabaseBusinessRow>();

  if (fallbackResult.error) {
    debugError("[businesses] Failed to resolve business through public table fallback", {
      businessSlug: normalizedBusinessSlug,
      message: fallbackResult.error.message,
    });
    throw new Error(`Supabase businesses query failed: ${fallbackResult.error.message}`);
  }

  debugLog("[businesses] Business resolved through public table fallback", {
    businessSlug: normalizedBusinessSlug,
    found: Boolean(fallbackResult.data),
  });

  return {
    business: fallbackResult.data ? mapSupabaseBusinessRow(fallbackResult.data) : null,
    ownershipVerified: hasVerifiedBusinessOwner(fallbackResult.data?.created_by_user_id ?? null),
  };
}

interface BusinessProductsLookupDependencies {
  getBusinessBySlugFromDatabase: typeof getBusinessBySlugFromDatabase;
  getBusinessByIdFromDatabase: typeof getBusinessByIdFromDatabase;
  getProductsByBusinessId: (businessId: BusinessId) => Promise<
    Awaited<ReturnType<typeof import("@/lib/data/products").getProductsByBusinessId>>
  >;
  mapProductToBusinessProduct: typeof import("@/lib/data/products").mapProductToBusinessProduct;
  debugLog: typeof debugLog;
}

export async function getBusinessByIdFromDatabase(businessId: string) {
  const normalizedBusinessId = requireBusinessId(businessId);

  debugLog("[businesses] Resolving business by database id", {
    businessId: normalizedBusinessId,
  });

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, is_active, created_at, updated_at, created_by_user_id",
    )
    .eq("id", normalizedBusinessId)
    .maybeSingle<AuthenticatedSupabaseBusinessRow>();

  if (error) {
    debugError("[businesses] Failed to resolve business by database id", {
      businessId: normalizedBusinessId,
    });
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  debugLog("[businesses] Business resolved by database id", {
    businessId: normalizedBusinessId,
    found: Boolean(data),
  });

  return data ? mapSupabaseBusinessRow(data) : null;
}

async function getBusinessesFromDatabase() {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, is_active, created_at, updated_at, created_by_user_id",
    )
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Supabase businesses query failed: ${error.message}`);
  }

  return ((data ?? []) as AuthenticatedSupabaseBusinessRow[]).map(mapSupabaseBusinessRow);
}

export async function getOwnedBusinessesForUser(userId: string): Promise<OwnedBusinessSummary[]> {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, is_active, updated_at, created_by_user_id")
    .eq("created_by_user_id", userId);

  if (error) {
    throw new Error(`Supabase owned businesses query failed: ${error.message}`);
  }

  return ((data ?? []) as OwnedBusinessSummaryRow[])
    .filter((business) => hasVerifiedBusinessOwner(business.created_by_user_id))
    .map(mapOwnedBusinessSummaryRow)
    .sort((left, right) => {
      const updatedAtDifference =
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

      if (updatedAtDifference !== 0) {
        return updatedAtDifference;
      }

      return left.businessSlug.localeCompare(right.businessSlug);
    });
}

async function countUnsupportedLegacyBusinesses() {
  const supabase = await createServerSupabaseAuthClient();
  const { count, error } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .is("created_by_user_id", null);

  if (error) {
    throw new Error(`Supabase businesses count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function getHomeBusinesses(
  operatorUserId?: string | null,
): Promise<HomeBusinessesSnapshot> {
  let databaseBusinesses: BusinessRecord[] = [];
  let unsupportedLegacyBusinessesCount = 0;

  try {
    databaseBusinesses = await getBusinessesFromDatabase();
  } catch (error) {
    debugError("[businesses] Failed to list businesses for home", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    unsupportedLegacyBusinessesCount = operatorUserId
      ? await countUnsupportedLegacyBusinesses()
      : 0;
  } catch (error) {
    debugError("[businesses] Failed to count unsupported legacy businesses for home", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const accessibleBusinesses = operatorUserId
    ? databaseBusinesses.filter(
        (business) =>
          business.isActive === true &&
          business.createdByUserId === operatorUserId &&
          hasVerifiedBusinessOwner(business.createdByUserId),
      )
    : [];

  return {
    realBusinesses: accessibleBusinesses.map(mapDatabaseBusinessToConfig),
    unsupportedLegacyBusinessesCount,
  };
}

async function buildBusinessProductsLookupResult(
  databaseBusiness: BusinessRecord | null,
  lookupValue: string,
  dependencies?: Partial<BusinessProductsLookupDependencies>,
  options?: { ownershipVerified?: boolean },
): Promise<BusinessProductsLookupResult> {
  (dependencies?.debugLog ?? debugLog)("[businesses] Received business lookup", {
    lookupValue,
    resolved: Boolean(databaseBusiness),
  });

  const isOwnershipVerified =
    options?.ownershipVerified === true ||
    hasVerifiedBusinessOwner(databaseBusiness?.createdByUserId ?? null);

  if (!databaseBusiness || !isOwnershipVerified || databaseBusiness.isActive !== true) {
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

  const resolveProductsByBusinessId = getProductsByBusinessId!;
  const toBusinessProduct = mapProductToBusinessProduct!;
  const products = await resolveProductsByBusinessId(databaseBusiness.businessId);

  (dependencies?.debugLog ?? debugLog)("[businesses] Products query completed", {
    lookupValue,
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
        products: products.map(toBusinessProduct),
      },
    };
}

export function createGetBusinessBySlugWithProducts(
  dependencies?: Partial<BusinessProductsLookupDependencies>,
) {
  return async function getBusinessBySlugWithProducts(
    businessSlug: string,
  ): Promise<BusinessProductsLookupResult> {
    if (dependencies?.getBusinessBySlugFromDatabase) {
      const databaseBusiness = await dependencies.getBusinessBySlugFromDatabase(businessSlug);

      return buildBusinessProductsLookupResult(databaseBusiness, businessSlug, dependencies);
    }

    const storefrontLookup = await getStorefrontBusinessLookupBySlug(businessSlug);

    return buildBusinessProductsLookupResult(
      storefrontLookup.business,
      businessSlug,
      dependencies,
      { ownershipVerified: storefrontLookup.ownershipVerified },
    );
  };
}

export const getBusinessBySlugWithProducts = createGetBusinessBySlugWithProducts();

export function createGetBusinessByIdWithProducts(
  dependencies?: Partial<BusinessProductsLookupDependencies>,
) {
  return async function getBusinessByIdWithProducts(
    businessId: string,
  ): Promise<BusinessProductsLookupResult> {
    const databaseBusiness = await (
      dependencies?.getBusinessByIdFromDatabase ?? getBusinessByIdFromDatabase
    )(businessId);

    return buildBusinessProductsLookupResult(databaseBusiness, businessId, dependencies);
  };
}

export const getBusinessByIdWithProducts = createGetBusinessByIdWithProducts();
