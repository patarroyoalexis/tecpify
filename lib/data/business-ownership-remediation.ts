import type {
  BusinessRecord,
  LegacyBusinessOwnershipRemediationRecord,
  LegacyBusinessRemediationStatus,
} from "@/types/businesses";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

interface LegacyBusinessOwnershipRemediationRow {
  business_id: string;
  business_slug: string;
  business_name: string;
  remediation_status: LegacyBusinessRemediationStatus;
  access_status: "accessible" | "inaccessible";
  requested_at: string | null;
  claimable_at: string | null;
  claimed_at: string | null;
}

interface RemediatedBusinessRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
}

function mapLegacyBusinessOwnershipRemediation(
  row: LegacyBusinessOwnershipRemediationRow,
): LegacyBusinessOwnershipRemediationRecord {
  return {
    businessId: row.business_id,
    businessSlug: row.business_slug,
    businessName: row.business_name,
    remediationStatus: row.remediation_status,
    accessStatus: row.access_status,
    ...(row.requested_at ? { requestedAt: row.requested_at } : {}),
    ...(row.claimable_at ? { claimableAt: row.claimable_at } : {}),
    ...(row.claimed_at ? { claimedAt: row.claimed_at } : {}),
  };
}

function mapBusinessRow(row: RemediatedBusinessRow): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
  };
}

export async function listCurrentUserLegacyBusinessOwnershipRemediations() {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase.rpc(
    "list_current_user_legacy_business_ownership_remediations",
  );

  if (error) {
    throw new Error(
      `No fue posible cargar el estado de remediacion legacy. ${error.message}`,
    );
  }

  return ((data ?? []) as LegacyBusinessOwnershipRemediationRow[]).map(
    mapLegacyBusinessOwnershipRemediation,
  );
}

export async function requestLegacyBusinessOwnershipRemediation(
  businessSlug: string,
) {
  const normalizedBusinessSlug = normalizeBusinessSlug(businessSlug);

  if (!normalizedBusinessSlug) {
    throw new Error("Debes indicar un businessSlug valido para solicitar remediacion.");
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase.rpc(
    "request_legacy_business_ownership_remediation",
    { requested_slug: normalizedBusinessSlug },
  );

  if (error) {
    throw new Error(error.message);
  }

  const [row] = (data ?? []) as LegacyBusinessOwnershipRemediationRow[];

  if (!row) {
    throw new Error(
      `No fue posible registrar la remediacion legacy para "${normalizedBusinessSlug}".`,
    );
  }

  return mapLegacyBusinessOwnershipRemediation(row);
}

export async function claimLegacyBusinessOwnershipRemediation(
  businessSlug: string,
) {
  const normalizedBusinessSlug = normalizeBusinessSlug(businessSlug);

  if (!normalizedBusinessSlug) {
    throw new Error("Debes indicar un businessSlug valido para reclamar ownership.");
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase.rpc("claim_legacy_business_ownership", {
    requested_slug: normalizedBusinessSlug,
  });

  if (error) {
    throw new Error(error.message);
  }

  const [row] = (data ?? []) as RemediatedBusinessRow[];

  if (!row) {
    throw new Error(
      `No fue posible remediar el ownership legacy para "${normalizedBusinessSlug}".`,
    );
  }

  return mapBusinessRow(row);
}
