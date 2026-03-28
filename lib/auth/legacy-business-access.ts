export interface LegacyBusinessOwnershipStateInput {
  createdByUserId: string | null;
}

export type LegacyBusinessRuntimeStatus = "owned" | "ownerless_unsupported";
export type BusinessOperationalAccessStatus = "accessible" | "inaccessible";

export interface LegacyBusinessOwnershipState {
  runtimeStatus: LegacyBusinessRuntimeStatus;
  accessStatus: BusinessOperationalAccessStatus;
  isSupported: boolean;
  isAccessible: boolean;
}

export const LEGACY_BUSINESS_OWNERSHIP_STRATEGY = {
  mode: "unsupported_ownerless_blocked",
} as const;

export function hasLegacyBusinessOwner(
  createdByUserId: string | null,
): createdByUserId is string {
  return typeof createdByUserId === "string" && createdByUserId.trim().length > 0;
}

export function resolveLegacyBusinessOwnershipState(
  input: LegacyBusinessOwnershipStateInput,
): LegacyBusinessOwnershipState {
  if (hasLegacyBusinessOwner(input.createdByUserId)) {
    return {
      runtimeStatus: "owned",
      accessStatus: "accessible",
      isSupported: true,
      isAccessible: true,
    };
  }

  return {
    runtimeStatus: "ownerless_unsupported",
    accessStatus: "inaccessible",
    isSupported: false,
    isAccessible: false,
  };
}

export function isLegacyBusinessBlocked(createdByUserId: string | null) {
  return !resolveLegacyBusinessOwnershipState({ createdByUserId }).isAccessible;
}
