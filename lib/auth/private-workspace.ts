import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { getOwnedBusinessesForUser } from "@/data/businesses";
import type { OwnedBusinessSummary } from "@/types/businesses";

export const ACTIVE_WORKSPACE_BUSINESS_COOKIE = "tecpify-active-business-slug";
export const CREATE_BUSINESS_ROUTE = "/dashboard/crear-negocio";

const ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface PrivateWorkspaceEntryResolution {
  ownedBusinesses: OwnedBusinessSummary[];
  activeBusiness: OwnedBusinessSummary | null;
  entryHref: string;
}

export function getBusinessDashboardHref(businessSlug: string) {
  return `/dashboard/${businessSlug}`;
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
        : CREATE_BUSINESS_ROUTE,
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
