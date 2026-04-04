import { NextResponse } from "next/server";

import { requirePlatformAdminApiUser } from "@/lib/auth/server";
import {
  getLocalDeliveryAdminCatalogSnapshot,
  importLocalDeliveryCatalogDocument,
} from "@/lib/data/local-delivery";
import { parseLocalDeliveryCatalogImportDocument } from "@/lib/local-delivery/core";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET() {
  const supabase = await createServerSupabaseAuthClient();
  const authResult = await requirePlatformAdminApiUser(supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const snapshot = await getLocalDeliveryAdminCatalogSnapshot();
    return NextResponse.json({ snapshot }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible leer el catalogo geográfico de domicilio local.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseAuthClient();
  const authResult = await requirePlatformAdminApiUser(supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para administrar el catalogo geografico no es valido." },
      { status: 400 },
    );
  }

  if (!isPlainObject(payload)) {
    return NextResponse.json(
      { error: "El payload del catalogo geografico debe ser un objeto JSON." },
      { status: 400 },
    );
  }

  const mode = typeof payload.mode === "string" ? payload.mode : "";
  const json = typeof payload.json === "string" ? payload.json : "";

  if (mode !== "validate" && mode !== "import") {
    return NextResponse.json(
      { error: 'mode debe ser "validate" o "import".' },
      { status: 400 },
    );
  }

  if (!json.trim()) {
    return NextResponse.json(
      { error: "Debes enviar el JSON del catalogo geográfico." },
      { status: 400 },
    );
  }

  const parsed = parseLocalDeliveryCatalogImportDocument(json);

  if (mode === "validate") {
    return NextResponse.json({ validation: parsed.validation }, { status: 200 });
  }

  if (!parsed.document || !parsed.validation.ok) {
    return NextResponse.json(
      {
        error: "El JSON no cumple el formato estricto esperado para importar el catalogo.",
        validation: parsed.validation,
      },
      { status: 400 },
    );
  }

  try {
    const result = await importLocalDeliveryCatalogDocument(parsed.document);
    const snapshot = await getLocalDeliveryAdminCatalogSnapshot();

    return NextResponse.json(
      {
        result,
        validation: parsed.validation,
        snapshot,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible importar el catalogo geográfico.";
    const statusCode = message.includes("migraciones manuales") ? 409 : 500;

    return NextResponse.json({ error: message, validation: parsed.validation }, { status: statusCode });
  }
}
