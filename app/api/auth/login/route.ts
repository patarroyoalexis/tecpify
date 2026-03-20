import { NextResponse } from "next/server";

import { sanitizeRedirectPath } from "@/lib/auth/server";
import { createOperatorSession, writeOperatorSession } from "@/lib/auth/session";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

interface LoginPayload {
  email: string;
  password: string;
  redirectTo?: string;
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
      { error: "Invalid JSON body for login." },
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
  const redirectTo = sanitizeRedirectPath(payload.redirectTo);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password son obligatorios." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Credenciales invalidas o usuario sin acceso." },
      { status: 401 },
    );
  }

  await writeOperatorSession(createOperatorSession(data.user.email ?? email, data.user.id));

  return NextResponse.json(
    {
      ok: true,
      redirectTo,
      operator: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
    },
    { status: 200 },
  );
}
