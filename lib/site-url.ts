import { getSiteUrlEnv } from "@/lib/env";

export function getSiteUrl() {
  return getSiteUrlEnv();
}

export function getAuthCallbackUrl(options?: { next?: string | null | undefined }) {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());

  if (options?.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    callbackUrl.searchParams.set("next", options.next);
  }

  return callbackUrl.toString();
}
