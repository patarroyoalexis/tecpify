import { NextResponse } from "next/server";

import { sanitizeRedirectPath } from "@/lib/auth/server";
import { createOperatorSession, writeOperatorSession } from "@/lib/auth/session";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

interface RegisterPayload {
  email: string;
  password: string;
  redirectTo?: string;
}

function isValidRegisterPayload(payload: unknown): payload is RegisterPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<RegisterPayload>;

  return typeof candidate.email === "string" && typeof candidate.password === "string";
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para registro no es valido." },
      { status: 400 },
    );
  }

  if (!isValidRegisterPayload(payload)) {
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

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La password debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "No fue posible completar el registro." },
      { status: 400 },
    );
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "No fue posible completar el registro." },
      { status: 500 },
    );
  }

  if (data.session && data.user.id) {
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
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      requiresEmailConfirmation: true,
      message:
        "Tu cuenta fue creada. Revisa tu correo para confirmar el acceso antes de iniciar sesion.",
      redirectTo: "/login",
    },
    { status: 201 },
  );
}
