import { NextResponse } from "next/server";

import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import { requireAuthenticatedApiUser } from "@/lib/auth/server";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { debugError, debugLog } from "@/lib/debug";
import type { BusinessRecord, CreateBusinessPayload } from "@/types/businesses";

interface SupabaseBusinessRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

function mapBusinessRow(row: SupabaseBusinessRow): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
  };
}

function validateCreateBusinessPayload(payload: unknown): payload is CreateBusinessPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<CreateBusinessPayload>;

  return typeof candidate.name === "string" && typeof candidate.slug === "string";
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedApiUser();

  if (!authResult.ok) {
    return authResult.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body for business creation." },
      { status: 400 },
    );
  }

  if (!validateCreateBusinessPayload(payload)) {
    return NextResponse.json(
      { error: "Invalid business payload. name y slug son obligatorios." },
      { status: 400 },
    );
  }

  const normalizedName = payload.name.trim().replace(/\s+/g, " ");
  const normalizedSlug = normalizeBusinessSlug(payload.slug);

  if (!normalizedName) {
    return NextResponse.json(
      { error: "El nombre del negocio es obligatorio." },
      { status: 400 },
    );
  }

  if (normalizedName.length > 80) {
    return NextResponse.json(
      { error: "El nombre del negocio no puede superar 80 caracteres." },
      { status: 400 },
    );
  }

  if (!normalizedSlug) {
    return NextResponse.json(
      {
        error:
          "El slug es obligatorio y debe contener letras o numeros validos despues de normalizarse.",
      },
      { status: 400 },
    );
  }

  if (normalizedSlug.length > 60) {
    return NextResponse.json(
      { error: "El slug no puede superar 60 caracteres." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const businessId = crypto.randomUUID();
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      id: businessId,
      slug: normalizedSlug,
      name: normalizedName,
      created_by_user_id: authResult.user.userId,
      created_at: now,
      updated_at: now,
    })
    .select("id, slug, name, created_at, updated_at, created_by_user_id")
    .single<SupabaseBusinessRow>();

  if (error) {
    const statusCode = error.code === "23505" ? 409 : 500;
    const message =
      error.code === "23505"
        ? `El slug "${normalizedSlug}" ya existe. Prueba con otro.`
        : `No fue posible crear el negocio en este momento. Revisa la configuracion de Supabase e intenta de nuevo. ${error.message}`;

    debugError("[businesses-api] Failed to create business", {
      slug: normalizedSlug,
      code: error.code ?? null,
      statusCode,
    });

    return NextResponse.json({ error: message }, { status: statusCode });
  }

  debugLog("[businesses-api] Created business", {
    businessId,
    slug: normalizedSlug,
  });

  return NextResponse.json({ business: mapBusinessRow(data) }, { status: 201 });
}
