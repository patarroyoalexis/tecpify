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
  const session = await readOperatorSession();

  if (!session) {
    redirect(buildLoginHref(redirectTo));
  }

  return session;
}

export async function requireOperatorApiSession() {
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
