import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import {
  hasLegacyBusinessOwner,
  isLegacyBusinessBlocked,
} from "@/lib/auth/legacy-business-access";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

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

export type BusinessAccessLevel = "owned";

export interface BusinessAccessResult {
  businessId: string;
  businessSlug: string;
  businessName: string;
  ownerUserId: string;
  accessLevel: BusinessAccessLevel;
}

interface BusinessAccessInput {
  businessId: string;
  businessSlug: string;
  ownerUserId: string | null;
}

export const hasVerifiedBusinessOwner = hasLegacyBusinessOwner;

export function getBusinessAccessLevel(
  { businessId, businessSlug, ownerUserId }: BusinessAccessInput,
  userId: string,
): BusinessAccessLevel | null {
  void businessId;
  void businessSlug;

  if (isLegacyBusinessBlocked(ownerUserId) || !hasVerifiedBusinessOwner(ownerUserId)) {
    return null;
  }

  if (ownerUserId === userId) {
    return "owned";
  }

  return null;
}

function mapBusinessAccessResult(row: BusinessOwnershipRow, userId: string): BusinessAccessResult | null {
  if (!hasVerifiedBusinessOwner(row.created_by_user_id)) {
    return null;
  }

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

export async function getBusinessAccessBySlug(
  slug: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const normalizedSlug = normalizeBusinessSlug(slug);

  if (!normalizedSlug) {
    return null;
  }

  const ownedBusiness = await getOwnedBusinessRowBySlug(normalizedSlug);

  if (!ownedBusiness) {
    return null;
  }

  return mapBusinessAccessResult(ownedBusiness, userId);
}

export async function getBusinessAccessById(
  businessId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const ownedBusiness = await getOwnedBusinessRowById(businessId);

  if (!ownedBusiness) {
    return null;
  }

  return mapBusinessAccessResult(ownedBusiness, userId);
}

export async function getBusinessAccessByOrderId(
  orderId: string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const ownedOrder = await getOwnedOrderRowById(orderId);

  if (ownedOrder?.business_id) {
    return getBusinessAccessById(ownedOrder.business_id, userId);
  }

  return null;
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
