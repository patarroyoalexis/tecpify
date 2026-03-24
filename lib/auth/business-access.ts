import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import {
  hasExplicitLegacyBusinessAccessConfigured,
  isExplicitlyAllowedLegacyBusiness,
} from "@/lib/auth/legacy-business-access";
import {
  createServerSupabaseAdminClient,
  createServerSupabaseAuthClient,
} from "@/lib/supabase/server";

interface BusinessOwnershipRow {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string | null;
}

interface OrderOwnershipRow {
  id: string;
  business_id: string;
}

export type BusinessAccessLevel = "owned" | "legacy_allowed";

export interface BusinessAccessResult {
  businessId: string;
  businessSlug: string;
  businessName: string;
  ownerUserId: string | null;
  accessLevel: BusinessAccessLevel;
}

interface BusinessAccessInput {
  businessId: string;
  businessSlug: string;
  ownerUserId: string | null;
}

export function getBusinessAccessLevel(
  { businessId, businessSlug, ownerUserId }: BusinessAccessInput,
  userId: string,
): BusinessAccessLevel | null {
  if (ownerUserId === userId) {
    return "owned";
  }

  if (
    isExplicitlyAllowedLegacyBusiness({
      businessId,
      businessSlug,
      ownerUserId,
    })
  ) {
    return "legacy_allowed";
  }

  return null;
}

function mapBusinessAccessResult(row: BusinessOwnershipRow, userId: string): BusinessAccessResult | null {
  const accessLevel = getBusinessAccessLevel(
    {
      businessId: row.id,
      businessSlug: row.slug,
      ownerUserId: row.created_by_user_id,
    },
    userId,
  );

  if (!accessLevel) {
    return null;
  }

  return {
    businessId: row.id,
    businessSlug: row.slug,
    businessName: row.name,
    ownerUserId: row.created_by_user_id,
    accessLevel,
  };
}

async function getOwnedBusinessRowBySlug(slug: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("slug", slug)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getOwnedBusinessRowById(businessId: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("id", businessId)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getOwnedOrderRowById(orderId: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, business_id")
    .eq("id", orderId)
    .maybeSingle<OrderOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al pedido: ${error.message}`);
  }

  return data;
}

async function getLegacyBusinessRowBySlug(slug: string) {
  if (!hasExplicitLegacyBusinessAccessConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("slug", slug)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getLegacyBusinessRowById(businessId: string) {
  if (!hasExplicitLegacyBusinessAccessConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("id", businessId)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getLegacyOrderRowById(orderId: string) {
  if (!hasExplicitLegacyBusinessAccessConfigured()) {
    return null;
  }

  const supabase = createServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, business_id")
    .eq("id", orderId)
    .maybeSingle<OrderOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al pedido: ${error.message}`);
  }

  return data;
}

export async function getBusinessAccessBySlug(
  slug: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const normalizedSlug = normalizeBusinessSlug(slug);

  if (!normalizedSlug) {
    return null;
  }

  const ownedBusiness = await getOwnedBusinessRowBySlug(normalizedSlug);

  if (ownedBusiness) {
    return mapBusinessAccessResult(ownedBusiness, userId);
  }

  const legacyBusiness = await getLegacyBusinessRowBySlug(normalizedSlug);

  if (!legacyBusiness) {
    return null;
  }

  return mapBusinessAccessResult(legacyBusiness, userId);
}

export async function getBusinessAccessById(
  businessId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const ownedBusiness = await getOwnedBusinessRowById(businessId);

  if (ownedBusiness) {
    return mapBusinessAccessResult(ownedBusiness, userId);
  }

  const legacyBusiness = await getLegacyBusinessRowById(businessId);

  if (!legacyBusiness) {
    return null;
  }

  return mapBusinessAccessResult(legacyBusiness, userId);
}

export async function getBusinessAccessByOrderId(
  orderId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const ownedOrder = await getOwnedOrderRowById(orderId);

  if (ownedOrder?.business_id) {
    return getBusinessAccessById(ownedOrder.business_id, userId);
  }

  const legacyOrder = await getLegacyOrderRowById(orderId);

  if (!legacyOrder?.business_id) {
    return null;
  }

  return getBusinessAccessById(legacyOrder.business_id, userId);
}

export function canAccessBusiness(
  userId: string,
  business: {
    businessId: string;
    businessSlug: string;
    ownerUserId: string | null;
  },
) {
  return getBusinessAccessLevel(business, userId) !== null;
}
