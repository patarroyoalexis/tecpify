import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import { isExplicitlyAllowedLegacyBusiness } from "@/lib/auth/legacy-business-access";

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

export async function getBusinessAccessBySlug(
  slug: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const normalizedSlug = normalizeBusinessSlug(slug);

  if (!normalizedSlug) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("slug", normalizedSlug)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapBusinessAccessResult(data, userId);
}

export async function getBusinessAccessById(
  businessId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, name, created_by_user_id")
    .eq("id", businessId)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapBusinessAccessResult(data, userId);
}

export async function getBusinessAccessByOrderId(
  orderId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, business_id")
    .eq("id", orderId)
    .maybeSingle<OrderOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al pedido: ${error.message}`);
  }

  if (!data?.business_id) {
    return null;
  }

  return getBusinessAccessById(data.business_id, userId);
}

export function canAccessBusiness(
  userId: string,
  business: {
    businessId: string;
    businessSlug: string;
    ownerUserId: string | null;
  },
) {
  return getBusinessAccessLevel(
    business,
    userId,
  ) !== null;
}
