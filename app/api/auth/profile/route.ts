import { NextResponse } from "next/server";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { requireAuthenticatedApiUser } from "@/lib/auth/server";

export async function GET() {
  const supabase = await createServerSupabaseAuthClient();
  const authResult = await requireAuthenticatedApiUser(supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, role, full_name, is_active, deactivated_at, created_at, updated_at")
    .eq("user_id", authResult.user.userId)
    .single();

  if (error) {
    return NextResponse.json(
      { error: `No fue posible cargar el perfil: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseAuthClient();
  const authResult = await requireAuthenticatedApiUser(supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  let payload: { fullName?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.fullName !== undefined && typeof payload.fullName !== "string") {
    return NextResponse.json({ error: "fullName debe ser un string" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("update_user_profile", {
    new_full_name: payload.fullName?.trim() || null,
  });

  if (error) {
    return NextResponse.json(
      { error: `No fue posible actualizar el perfil: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE() {
  const supabase = await createServerSupabaseAuthClient();
  const authResult = await requireAuthenticatedApiUser(supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  const { error } = await supabase.rpc("deactivate_user_profile");

  if (error) {
    return NextResponse.json(
      { error: `No fue posible cerrar la cuenta: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
