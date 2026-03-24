export const LEGACY_BUSINESS_ACCESS_STRATEGY: {
  mode: "explicit_allowlist";
  allowedBusinessIds: readonly string[];
  allowedBusinessSlugs: readonly string[];
} = {
  mode: "explicit_allowlist",
  allowedBusinessIds: [],
  allowedBusinessSlugs: [],
};

export function hasExplicitLegacyBusinessAccessConfigured() {
  return (
    LEGACY_BUSINESS_ACCESS_STRATEGY.allowedBusinessIds.length > 0 ||
    LEGACY_BUSINESS_ACCESS_STRATEGY.allowedBusinessSlugs.length > 0
  );
}

interface LegacyBusinessPermissionInput {
  businessId: string;
  businessSlug: string;
  ownerUserId: string | null;
}

export function isExplicitlyAllowedLegacyBusiness({
  businessId,
  businessSlug,
  ownerUserId,
}: LegacyBusinessPermissionInput) {
  if (ownerUserId !== null) {
    return false;
  }

  return (
    LEGACY_BUSINESS_ACCESS_STRATEGY.allowedBusinessIds.includes(businessId) ||
    LEGACY_BUSINESS_ACCESS_STRATEGY.allowedBusinessSlugs.includes(businessSlug)
  );
}
