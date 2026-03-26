export interface BusinessRecord {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
}

export interface CreateBusinessPayload {
  name: string;
  slug: string;
}

export type LegacyBusinessRemediationStatus =
  | "ownerless_unassigned"
  | "ownerless_requested"
  | "ownerless_claimable"
  | "remediated";

export type BusinessOperationalAccessStatus = "accessible" | "inaccessible";

export interface LegacyBusinessOwnershipRemediationRecord {
  businessId: string;
  businessSlug: string;
  businessName: string;
  remediationStatus: LegacyBusinessRemediationStatus;
  accessStatus: BusinessOperationalAccessStatus;
  requestedAt?: string;
  claimableAt?: string;
  claimedAt?: string;
}
