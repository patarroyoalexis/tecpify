import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { readOperatorSession } from "@/lib/auth/session";

export function sanitizeRedirectPath(redirectTo: string | null | undefined) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
}

export function buildLoginHref(redirectTo: string) {
  const safeRedirectPath = sanitizeRedirectPath(redirectTo);
  const searchParams = new URLSearchParams({ redirectTo: safeRedirectPath });
  return `/login?${searchParams.toString()}`;
}

export async function getOperatorSession() {
  return readOperatorSession();
}

export async function requireOperatorSession(redirectTo: string) {
  // Route protection is resolved against the signed operator cookie, not a live Supabase session.
  const session = await readOperatorSession();

  if (!session) {
    redirect(buildLoginHref(redirectTo));
  }

  return session;
}

export async function requireOperatorApiSession() {
  // API authorization also relies on the operator cookie so routes and APIs share the same authority.
  const session = await readOperatorSession();

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Debes iniciar sesion para usar este espacio operativo." },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
