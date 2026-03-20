import { NextResponse } from "next/server";

import { requireOperatorApiSession } from "@/lib/auth/server";
import { debugError, debugLog } from "@/lib/debug";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeBusinessSlug } from "@/lib/businesses/slug";
import type { BusinessRecord, CreateBusinessPayload } from "@/types/businesses";

interface SupabaseBusinessRow {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapBusinessRow(row: SupabaseBusinessRow): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const auth = await requireOperatorApiSession();

  if (!auth.ok) {
    return auth.response;
  }

  const { session } = auth;

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

  if (!normalizedSlug) {
    return NextResponse.json(
      {
        error:
          "El slug es obligatorio y debe contener letras o numeros validos despues de normalizarse.",
      },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: existingBusiness, error: lookupError } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (lookupError) {
    debugError("[businesses-api] Failed to verify slug uniqueness", {
      slug: normalizedSlug,
      code: lookupError.code ?? null,
    });
    return NextResponse.json(
      { error: `No fue posible validar el slug: ${lookupError.message}` },
      { status: 500 },
    );
  }

  if (existingBusiness) {
    return NextResponse.json(
      { error: `El slug "${normalizedSlug}" ya existe. Prueba con otro.` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const businessId = crypto.randomUUID();
  const insertPayload = {
    id: businessId,
    slug: normalizedSlug,
    name: normalizedName,
    created_by_user_id: session.userId,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("businesses")
    .insert(insertPayload)
    .select("id, slug, name, created_by_user_id, created_at, updated_at")
    .single<SupabaseBusinessRow>();

  if (error) {
    const statusCode = error.code === "23505" ? 409 : 500;
    const message =
      error.code === "23505"
        ? `El slug "${normalizedSlug}" ya existe. Prueba con otro.`
        : `No fue posible crear el negocio: ${error.message}`;

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
