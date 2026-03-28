import { getSiteUrlEnv } from "@/lib/env";

export function getSiteUrl() {
  return getSiteUrlEnv();
}

export function getAuthCallbackUrl(options?: {
  next?: string | null | undefined;
  intent?: "login" | "register" | null | undefined;
}) {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());

  if (options?.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    callbackUrl.searchParams.set("next", options.next);
  }

  if (options?.intent === "login" || options?.intent === "register") {
    callbackUrl.searchParams.set("intent", options.intent);
  }

  return callbackUrl.toString();
}
