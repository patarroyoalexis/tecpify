import { NextResponse } from "next/server";

import {
  getGoogleAuthEntryPath,
  isGoogleAuthEnabled,
} from "@/lib/auth/google-auth";
import { sanitizeRedirectPath } from "@/lib/auth/redirect-path";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

function buildAuthEntryRedirect(
  requestUrl: URL,
  options: {
    redirectTo?: string | null;
    error: string;
  },
) {
  const redirectUrl = new URL(getGoogleAuthEntryPath(), requestUrl);
  if (options.redirectTo) {
    redirectUrl.searchParams.set("redirectTo", options.redirectTo);
  }
  redirectUrl.searchParams.set("error", options.error);
  return redirectUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const hasExplicitRedirectTo = requestUrl.searchParams.has("redirectTo");
  const redirectTo = hasExplicitRedirectTo
    ? sanitizeRedirectPath(requestUrl.searchParams.get("redirectTo"), "") || null
    : null;

  if (!isGoogleAuthEnabled()) {
    return NextResponse.redirect(
      buildAuthEntryRedirect(requestUrl, {
        redirectTo,
        error: "google_auth_unavailable",
      }),
    );
  }

  const supabase = await createServerSupabaseAuthClient();
  const callbackUrl = redirectTo
    ? getAuthCallbackUrl({ next: redirectTo })
    : getAuthCallbackUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      buildAuthEntryRedirect(requestUrl, {
        redirectTo,
        error: "google_auth_start_failed",
      }),
    );
  }


  return NextResponse.redirect(data.url);
} 
