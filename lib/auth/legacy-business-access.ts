export const LEGACY_BUSINESS_OWNERSHIP_STRATEGY = {
  mode: "block_without_owner",
} as const;

export function isLegacyBusinessBlocked(ownerUserId: string | null) {
  return ownerUserId === null;
}

export function isLegacyBusinessUsable(ownerUserId: string | null) {
  return !isLegacyBusinessBlocked(ownerUserId);
}
