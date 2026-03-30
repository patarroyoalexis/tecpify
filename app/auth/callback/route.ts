import { NextResponse } from "next/server";

import { getGoogleAuthEntryPath, isGoogleAuthEnabled } from "@/lib/auth/google-auth";
import { sanitizePrivateRedirectPath, sanitizeRedirectPath } from "@/lib/auth/server";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

function buildRedirectUrl(path: string, searchParams?: Record<string, string>) {
  const redirectUrl = new URL(path, getSiteUrl());

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next =
    code || type === "signup"
      ? sanitizePrivateRedirectPath(requestUrl.searchParams.get("next"))
      : sanitizeRedirectPath(requestUrl.searchParams.get("next"));
  const supabase = await createServerSupabaseAuthClient();

  if (code) {
    if (!isGoogleAuthEnabled()) {
      return NextResponse.redirect(
        buildRedirectUrl(getGoogleAuthEntryPath(), {
          redirectTo: next,
          error: "google_auth_unavailable",
        }),
      );
    }

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.user) {
        throw new Error(error?.message || "No fue posible confirmar la sesion.");
      }

      return NextResponse.redirect(buildRedirectUrl(next));
    } catch {
      return NextResponse.redirect(
        buildRedirectUrl(getGoogleAuthEntryPath(), {
          redirectTo: next,
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

      return NextResponse.redirect(buildRedirectUrl(next));
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
