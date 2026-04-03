import { requireBusinessSlug } from "@/lib/businesses/slug";
import {
  requireBusinessId,
  requireOrderId,
  type BusinessId,
  type BusinessSlug,
  type OrderId,
} from "@/types/identifiers";
import {
  hasLegacyBusinessOwner,
  isLegacyBusinessBlocked,
} from "@/lib/auth/legacy-business-access";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

interface BusinessOwnershipRow {
  id: string;
  slug: string;
  name: string;
  transfer_instructions: string | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  accepts_card: boolean | null;
  allows_fiado: boolean | null;
  is_active: boolean;
  created_by_user_id: string | null;
}

interface OrderOwnershipRow {
  id: string;
  business_id: string;
}

export type BusinessAccessLevel = "owned";

export interface BusinessAccessResult {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  businessName: string;
  transferInstructions: string | null;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
  isActive: boolean;
  createdByUserId: string;
  accessLevel: BusinessAccessLevel;
}

interface BusinessAccessInput {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  isActive: boolean;
  createdByUserId: string | null;
}

export const hasVerifiedBusinessOwner = hasLegacyBusinessOwner;

export function getBusinessAccessLevel(
  { businessId, businessSlug, isActive, createdByUserId }: BusinessAccessInput,
  userId: string,
): BusinessAccessLevel | null {
  void businessId;
  void businessSlug;

  if (!isActive) {
    return null;
  }

  if (isLegacyBusinessBlocked(createdByUserId) || !hasVerifiedBusinessOwner(createdByUserId)) {
    return null;
  }

  if (createdByUserId === userId) {
    return "owned";
  }

  return null;
}

function mapBusinessAccessResult(row: BusinessOwnershipRow, userId: string): BusinessAccessResult | null {
  if (!hasVerifiedBusinessOwner(row.created_by_user_id)) {
    return null;
  }

  const businessId = requireBusinessId(row.id);
  const businessSlug = requireBusinessSlug(row.slug);
  const accessLevel = getBusinessAccessLevel(
      {
        businessId,
        businessSlug,
        isActive: row.is_active,
        createdByUserId: row.created_by_user_id,
      },
      userId,
  );

  if (!accessLevel) {
    return null;
  }

  return {
    businessId,
    businessSlug,
    businessName: row.name,
    transferInstructions: row.transfer_instructions,
    acceptsCash: row.accepts_cash ?? true,
    acceptsTransfer: row.accepts_transfer ?? true,
    acceptsCard: row.accepts_card ?? true,
    allowsFiado: row.allows_fiado ?? false,
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    accessLevel,
  };
}

async function getOwnedBusinessRowBySlug(businessSlug: BusinessSlug) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, is_active, created_by_user_id",
    )
    .eq("slug", businessSlug)
    .eq("is_active", true)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getOwnedBusinessRowById(businessId: BusinessId | string) {
  const normalizedBusinessId = requireBusinessId(businessId);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, slug, name, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, is_active, created_by_user_id",
    )
    .eq("id", normalizedBusinessId)
    .eq("is_active", true)
    .maybeSingle<BusinessOwnershipRow>();

  if (error) {
    throw new Error(`No fue posible validar acceso al negocio: ${error.message}`);
  }

  return data;
}

async function getOwnedOrderRowById(orderId: OrderId | string) {
  const normalizedOrderId = requireOrderId(orderId);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, business_id")
    .eq("id", normalizedOrderId)
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
  let normalizedBusinessSlug;
  try {
    normalizedBusinessSlug = requireBusinessSlug(slug);
  } catch {
    return null;
  }

  const ownedBusiness = await getOwnedBusinessRowBySlug(normalizedBusinessSlug);

  if (!ownedBusiness) {
    return null;
  }

  return mapBusinessAccessResult(ownedBusiness, userId);
}

export async function getBusinessAccessById(
  businessId: BusinessId | string,
  userId: string,
): Promise<BusinessAccessResult | null> {
  const ownedBusiness = await getOwnedBusinessRowById(businessId);

  if (!ownedBusiness) {
    return null;
  }

  return mapBusinessAccessResult(ownedBusiness, userId);
}

export async function getBusinessAccessByOrderId(
  orderId: OrderId | string,
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
    businessId: BusinessId;
    businessSlug: BusinessSlug;
    isActive: boolean;
    createdByUserId: string | null;
  },
) {
  return getBusinessAccessLevel(business, userId) !== null;
}
