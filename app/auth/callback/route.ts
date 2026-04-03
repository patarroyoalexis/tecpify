import { NextResponse } from "next/server";

import { getGoogleAuthEntryPath, isGoogleAuthEnabled } from "@/lib/auth/google-auth";
import {
  isAllowedPostAuthRedirectPath,
  resolvePrivateWorkspaceEntryFromCookies,
} from "@/lib/auth/private-workspace";
import { sanitizePrivateRedirectPath, sanitizeRedirectPath } from "@/lib/auth/server";
import { getSiteUrl } from "@/lib/site-url";
import {
  applySupabaseAuthCookies,
  createServerSupabaseAuthClient,
  type SupabaseAuthCookieMutation,
} from "@/lib/supabase/server";

function buildRedirectUrl(
  path: string,
  searchParams?: Record<string, string | null | undefined>,
) {
  const redirectUrl = new URL(path, getSiteUrl());

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const hasExplicitNext = requestUrl.searchParams.has("next");
  const explicitNext = hasExplicitNext
    ? sanitizeRedirectPath(requestUrl.searchParams.get("next"), "") || null
    : null;
  const next =
    code || type === "signup"
      ? sanitizePrivateRedirectPath(requestUrl.searchParams.get("next"))
      : sanitizeRedirectPath(requestUrl.searchParams.get("next"));
  const authCookiesToSet: SupabaseAuthCookieMutation[] = [];
  const supabase = await createServerSupabaseAuthClient({
    onCookiesSet(cookiesToSet) {
      authCookiesToSet.push(...cookiesToSet);
    },
  });

  if (code) {
    if (!isGoogleAuthEnabled()) {
      return NextResponse.redirect(
        buildRedirectUrl(getGoogleAuthEntryPath(), {
          redirectTo: explicitNext,
          error: "google_auth_unavailable",
        }),
      );
    }

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.user) {
        throw new Error(error?.message || "No fue posible confirmar la sesion.");
      }

      const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(data.user.id);
      const redirectTo =
        hasExplicitNext && explicitNext && isAllowedPostAuthRedirectPath(explicitNext)
          ? explicitNext
          : workspaceEntry.entryHref;

      const response = NextResponse.redirect(buildRedirectUrl(redirectTo));
      return applySupabaseAuthCookies(response, authCookiesToSet);
    } catch {
      return NextResponse.redirect(
        buildRedirectUrl(getGoogleAuthEntryPath(), {
          redirectTo: explicitNext,
          error: "auth_callback_failed",
        }),
      );
    }
  }

  if (tokenHash && type) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "email" | "recovery" | "invite" | "email_change",
      });

      if (error || !data.user) {
        throw new Error(error?.message || "No fue posible confirmar el correo.");
      }

      const response = NextResponse.redirect(buildRedirectUrl(next));
      return applySupabaseAuthCookies(response, authCookiesToSet);
    } catch {
      return NextResponse.redirect(
        buildRedirectUrl(getGoogleAuthEntryPath(), {
          redirectTo: next,
          error: "auth_callback_failed",
        }),
      );
    }
  }

  return NextResponse.redirect(
    buildRedirectUrl(getGoogleAuthEntryPath(), {
      redirectTo: next,
      error: "auth_callback_missing_code",
    }),
  );
}
