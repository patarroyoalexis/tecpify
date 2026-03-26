import type {
  BusinessOperationalAccessStatus,
  LegacyBusinessRemediationStatus,
} from "@/types/businesses";

export interface LegacyBusinessOwnershipStateInput {
  ownerUserId: string | null;
  remediationStatus?: Exclude<LegacyBusinessRemediationStatus, "remediated"> | null;
}

export interface LegacyBusinessOwnershipState {
  remediationStatus: LegacyBusinessRemediationStatus;
  accessStatus: BusinessOperationalAccessStatus;
  isRemediated: boolean;
  isAccessible: boolean;
}

export const LEGACY_BUSINESS_OWNERSHIP_STRATEGY = {
  mode: "audited_claim_before_access",
} as const;

export function hasLegacyBusinessOwner(ownerUserId: string | null): ownerUserId is string {
  return typeof ownerUserId === "string" && ownerUserId.trim().length > 0;
}

export function resolveLegacyBusinessOwnershipState(
  input: LegacyBusinessOwnershipStateInput,
): LegacyBusinessOwnershipState {
  if (hasLegacyBusinessOwner(input.ownerUserId)) {
    return {
      remediationStatus: "remediated",
      accessStatus: "accessible",
      isRemediated: true,
      isAccessible: true,
    };
  }

  const remediationStatus = input.remediationStatus ?? "ownerless_unassigned";

  return {
    remediationStatus,
    accessStatus: "inaccessible",
    isRemediated: false,
    isAccessible: false,
  };
}

export function isLegacyBusinessBlocked(
  ownerUserId: string | null,
  remediationStatus?: Exclude<LegacyBusinessRemediationStatus, "remediated"> | null,
) {
  return !resolveLegacyBusinessOwnershipState({ ownerUserId, remediationStatus }).isAccessible;
}
