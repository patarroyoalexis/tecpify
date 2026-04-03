import { NextResponse } from "next/server";

import { authenticateOperatorCredentials } from "@/lib/auth/operator-auth";
import { resolvePostAuthRedirectPath } from "@/lib/auth/private-workspace";
import {
  applySupabaseAuthCookies,
  type SupabaseAuthCookieMutation,
} from "@/lib/supabase/server";

interface LoginPayload {
  email: string;
  password: string;
  redirectTo?: string;
  hasExplicitRedirectTo?: boolean;
}

function isValidLoginPayload(payload: unknown): payload is LoginPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<LoginPayload>;

  return typeof candidate.email === "string" && typeof candidate.password === "string";
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para login no es valido." },
      { status: 400 },
    );
  }

  if (!isValidLoginPayload(payload)) {
    return NextResponse.json(
      { error: "Debes enviar email y password validos." },
      { status: 400 },
    );
  }

  const email = payload.email.trim().toLowerCase();
  const password = payload.password;
  const hasExplicitRedirectTo = payload.hasExplicitRedirectTo === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password son obligatorios." },
      { status: 400 },
    );
  }

  try {
    const authCookiesToSet: SupabaseAuthCookieMutation[] = [];
    const identity = await authenticateOperatorCredentials(email, password, {
      onCookiesSet(cookiesToSet) {
        authCookiesToSet.push(...cookiesToSet);
      },
    });
    const resolvedRedirect = await resolvePostAuthRedirectPath(identity.user.id, {
      hasExplicitRedirectTo,
      redirectTo: payload.redirectTo,
    });

    const response = NextResponse.json(
      {
        ok: true,
        redirectTo: resolvedRedirect.redirectTo,
        operator: {
          id: identity.user.id,
          email: identity.user.email ?? email,
        },
      },
      { status: 200 },
    );

    return applySupabaseAuthCookies(response, authCookiesToSet);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Credenciales invalidas, cuenta no confirmada o usuario sin acceso.",
      },
      { status: 401 },
    );
  }
}
