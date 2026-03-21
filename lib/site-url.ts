const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return normalizeSiteUrl(configuredSiteUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_SITE_URL;
  }

  throw new Error(
    "Missing NEXT_PUBLIC_SITE_URL environment variable in production.",
  );
}

export function getAuthCallbackUrl(options?: { next?: string | null | undefined }) {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());

  if (options?.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    callbackUrl.searchParams.set("next", options.next);
  }

  return callbackUrl.toString();
}
