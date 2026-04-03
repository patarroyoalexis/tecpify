import { NextResponse } from "next/server";

import { clearActiveWorkspaceBusinessCookie } from "@/lib/auth/private-workspace";
import { signOutAuthenticatedOperator } from "@/lib/auth/operator-auth";
import {
  applySupabaseAuthCookies,
  type SupabaseAuthCookieMutation,
} from "@/lib/supabase/server";

export async function POST() {
  const authCookiesToSet: SupabaseAuthCookieMutation[] = [];
  await signOutAuthenticatedOperator({
    onCookiesSet(cookiesToSet) {
      authCookiesToSet.push(...cookiesToSet);
    },
  });
  const response = NextResponse.json({ ok: true }, { status: 200 });
  applySupabaseAuthCookies(response, authCookiesToSet);
  clearActiveWorkspaceBusinessCookie(response);
  return response;
}
