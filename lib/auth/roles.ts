export const APP_ROLES = ["platform_admin", "business_owner", "customer"] as const;

export const MVP_ENABLED_APP_ROLES = ["platform_admin", "business_owner"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type MvpEnabledAppRole = (typeof MVP_ENABLED_APP_ROLES)[number];

export const DEFAULT_APP_ROLE: AppRole = "business_owner";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export function isMvpEnabledAppRole(value: unknown): value is MvpEnabledAppRole {
  return typeof value === "string" && MVP_ENABLED_APP_ROLES.includes(value as MvpEnabledAppRole);
}

export function isPlatformAdminRole(role: AppRole) {
  return role === "platform_admin";
}

export function canAccessBusinessWorkspaceRole(role: AppRole) {
  return role === "business_owner" || role === "platform_admin";
}

export function getAppRoleLabel(role: AppRole) {
  switch (role) {
    case "platform_admin":
      return "Platform admin";
    case "business_owner":
      return "Business owner";
    case "customer":
      return "Customer";
    default: {
      const exhaustiveCheck: never = role;
      return exhaustiveCheck;
    }
  }
}
