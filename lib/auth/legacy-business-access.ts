export interface LegacyBusinessOwnershipStateInput {
  ownerUserId: string | null;
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

export function hasLegacyBusinessOwner(ownerUserId: string | null): ownerUserId is string {
  return typeof ownerUserId === "string" && ownerUserId.trim().length > 0;
}

export function resolveLegacyBusinessOwnershipState(
  input: LegacyBusinessOwnershipStateInput,
): LegacyBusinessOwnershipState {
  if (hasLegacyBusinessOwner(input.ownerUserId)) {
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

export function isLegacyBusinessBlocked(ownerUserId: string | null) {
  return !resolveLegacyBusinessOwnershipState({ ownerUserId }).isAccessible;
}
