import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { getOwnedBusinessesForUser } from "@/data/businesses";
import { sanitizeRedirectPath } from "@/lib/auth/redirect-path";
import type { OwnedBusinessSummary } from "@/types/businesses";

export const ACTIVE_WORKSPACE_BUSINESS_COOKIE = "tecpify-active-business-slug";
export const CREATE_BUSINESS_ROUTE = "/ajustes/crear-negocio";
const ALLOWED_POST_AUTH_REDIRECT_PATH_PREFIXES = [
  "/admin",
  "/ajustes",
  "/dashboard",
  "/metricas",
  "/onboarding",
  "/pedidos",
];

const ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface PrivateWorkspaceEntryResolution {
  ownedBusinesses: OwnedBusinessSummary[];
  activeBusiness: OwnedBusinessSummary | null;
  entryHref: string;
}

export function getBusinessDashboardHref(businessSlug: string) {
  return `/dashboard/${businessSlug}`;
}

export function isAllowedPostAuthRedirectPath(redirectTo: string) {
  const pathname = redirectTo.split(/[?#]/, 1)[0];

  return ALLOWED_POST_AUTH_REDIRECT_PATH_PREFIXES.some(
    (allowedPrefix) => pathname === allowedPrefix || pathname.startsWith(`${allowedPrefix}/`),
  );
}

export function pickActiveWorkspaceBusiness(
  ownedBusinesses: OwnedBusinessSummary[],
  preferredBusinessSlug?: string | null,
) {
  if (ownedBusinesses.length === 0) {
    return null;
  }

  if (preferredBusinessSlug) {
    const preferredBusiness = ownedBusinesses.find(
      (business) => business.businessSlug === preferredBusinessSlug,
    );

    if (preferredBusiness) {
      return preferredBusiness;
    }
  }

  return ownedBusinesses[0] ?? null;
}

export function createResolvePrivateWorkspaceEntry(
  dependencies: {
    getOwnedBusinessesForUser?: typeof getOwnedBusinessesForUser;
  } = {},
) {
  return async function resolvePrivateWorkspaceEntry(
    userId: string,
    options?: { preferredBusinessSlug?: string | null },
  ): Promise<PrivateWorkspaceEntryResolution> {
    const ownedBusinesses = await (
      dependencies.getOwnedBusinessesForUser ?? getOwnedBusinessesForUser
    )(userId);
    const activeBusiness = pickActiveWorkspaceBusiness(
      ownedBusinesses,
      options?.preferredBusinessSlug,
    );

    return {
      ownedBusinesses,
      activeBusiness,
      entryHref: activeBusiness
        ? getBusinessDashboardHref(activeBusiness.businessSlug)
        : "/onboarding",
    };
  };
}

export const resolvePrivateWorkspaceEntry = createResolvePrivateWorkspaceEntry();

export async function resolvePrivateWorkspaceEntryFromCookies(userId: string) {
  const cookieStore = await cookies();
  return resolvePrivateWorkspaceEntry(userId, {
    preferredBusinessSlug: cookieStore.get(ACTIVE_WORKSPACE_BUSINESS_COOKIE)?.value ?? null,
  });
}

export function createResolvePostAuthRedirectPath(dependencies: {
  resolvePrivateWorkspaceEntry?: typeof resolvePrivateWorkspaceEntry;
} = {}) {
  const resolveWorkspaceEntry =
    dependencies.resolvePrivateWorkspaceEntry ?? resolvePrivateWorkspaceEntry;

  return async function resolvePostAuthRedirectPath(
    userId: string,
    options: {
      hasExplicitRedirectTo?: boolean;
      redirectTo?: string | null | undefined;
      preferredBusinessSlug?: string | null;
    } = {},
  ) {
    const workspaceEntry = await resolveWorkspaceEntry(userId, {
      preferredBusinessSlug: options.preferredBusinessSlug ?? null,
    });
    const explicitRedirectTo = sanitizeRedirectPath(options.redirectTo, "");

    if (
      options.hasExplicitRedirectTo &&
      explicitRedirectTo &&
      isAllowedPostAuthRedirectPath(explicitRedirectTo)
    ) {
      return {
        workspaceEntry,
        redirectTo: explicitRedirectTo,
      };
    }

    return {
      workspaceEntry,
      redirectTo: workspaceEntry.entryHref,
    };
  };
}

export const resolvePostAuthRedirectPath = createResolvePostAuthRedirectPath();

export function persistActiveWorkspaceBusinessCookie(
  response: NextResponse,
  businessSlug: string,
) {
  response.cookies.set(ACTIVE_WORKSPACE_BUSINESS_COOKIE, businessSlug, {
    httpOnly: true,
    maxAge: ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}

export function clearActiveWorkspaceBusinessCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_WORKSPACE_BUSINESS_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
}
