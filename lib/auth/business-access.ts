import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OperatorSession } from "@/lib/auth/session";

export interface BusinessAccessRecord {
  id: string;
  slug: string;
  createdByUserId: string | null;
}

interface BusinessAccessRow {
  id: string;
  slug: string;
  created_by_user_id: string | null;
}

interface OrderBusinessLookupRow {
  business_id: string;
}

function mapBusinessAccessRow(row: BusinessAccessRow): BusinessAccessRecord {
  return {
    id: row.id,
    slug: row.slug,
    createdByUserId: row.created_by_user_id,
  };
}

export function canOperatorAccessBusiness(
  operator: OperatorSession,
  business: Pick<BusinessAccessRecord, "createdByUserId">,
) {
  return !business.createdByUserId || business.createdByUserId === operator.userId;
}

export async function getBusinessAccessRecordBySlug(slug: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, created_by_user_id")
    .eq("slug", slug)
    .maybeSingle<BusinessAccessRow>();

  if (error) {
    throw new Error(`Supabase businesses access query failed: ${error.message}`);
  }

  return data ? mapBusinessAccessRow(data) : null;
}

export async function getBusinessAccessRecordById(businessId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, slug, created_by_user_id")
    .eq("id", businessId)
    .maybeSingle<BusinessAccessRow>();

  if (error) {
    throw new Error(`Supabase businesses access query failed: ${error.message}`);
  }

  return data ? mapBusinessAccessRow(data) : null;
}

export async function getBusinessAccessRecordByOrderId(orderId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("business_id")
    .eq("id", orderId)
    .maybeSingle<OrderBusinessLookupRow>();

  if (error) {
    throw new Error(`Supabase orders access lookup failed: ${error.message}`);
  }

  if (!data?.business_id) {
    return null;
  }

  return getBusinessAccessRecordById(data.business_id);
}
