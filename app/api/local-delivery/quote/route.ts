import { NextResponse } from "next/server";

import { getStorefrontBusinessLookupBySlug } from "@/data/businesses";
import { quoteStorefrontLocalDeliveryByBusinessId } from "@/lib/data/local-delivery";
import { requireBusinessSlug } from "@/lib/businesses/slug";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para cotizar domicilio local no es valido." },
      { status: 400 },
    );
  }

  if (!isPlainObject(payload)) {
    return NextResponse.json(
      { error: "El payload para cotizar domicilio local debe ser un objeto JSON." },
      { status: 400 },
    );
  }

  const businessSlug =
    typeof payload.businessSlug === "string" ? payload.businessSlug : "";
  const neighborhoodId =
    typeof payload.neighborhoodId === "string" ? payload.neighborhoodId.trim() : "";

  let normalizedBusinessSlug = "";

  try {
    normalizedBusinessSlug = requireBusinessSlug(businessSlug);
  } catch {
    normalizedBusinessSlug = "";
  }

  if (!normalizedBusinessSlug) {
    return NextResponse.json(
      { error: "businessSlug es obligatorio y debe ser valido." },
      { status: 400 },
    );
  }

  if (!neighborhoodId) {
    return NextResponse.json(
      { error: "neighborhoodId es obligatorio para cotizar domicilio local." },
      { status: 400 },
    );
  }

  const storefrontLookup = await getStorefrontBusinessLookupBySlug(normalizedBusinessSlug);

  if (!storefrontLookup.business || !storefrontLookup.ownershipVerified) {
    return NextResponse.json(
      { error: "No encontramos un negocio publico valido para este slug." },
      { status: 404 },
    );
  }

  try {
    const quote = await quoteStorefrontLocalDeliveryByBusinessId({
      businessId: storefrontLookup.business.businessId,
      neighborhoodId,
      deliveryType: "domicilio",
    });

    return NextResponse.json({ quote }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cotizar el domicilio local.",
      },
      { status: 500 },
    );
  }
}
