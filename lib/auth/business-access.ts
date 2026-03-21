import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";

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

export type BusinessAccessLevel = "owned" | "legacy_shared";

export interface BusinessAccessResult {
  businessId: string;
  businessSlug: string;
  businessName: string;
  ownerUserId: string | null;
  accessLevel: BusinessAccessLevel;
}

function mapBusinessAccessResult(row: BusinessOwnershipRow, userId: string): BusinessAccessResult | null {
  if (row.created_by_user_id && row.created_by_user_id !== userId) {
    return null;
  }

  return {
    businessId: row.id,
    businessSlug: row.slug,
    businessName: row.name,
    ownerUserId: row.created_by_user_id,
    accessLevel: row.created_by_user_id === null ? "legacy_shared" : "owned",
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

export function canAccessBusiness(userId: string, ownerUserId: string | null) {
  return ownerUserId === null || ownerUserId === userId;
}
