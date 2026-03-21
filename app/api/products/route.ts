import { NextResponse } from "next/server";

import { getBusinessAccessBySlug } from "@/lib/auth/business-access";
import { requireOperatorApiSession } from "@/lib/auth/server";
import {
  createProductInDatabase,
  getAdminProductsByBusinessId,
} from "@/lib/data/products";

export async function GET(request: Request) {
  const sessionResult = await requireOperatorApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const { searchParams } = new URL(request.url);
  const businessSlug = searchParams.get("businessSlug")?.trim();

  if (!businessSlug) {
    return NextResponse.json(
      { error: "Debes indicar el businessSlug para consultar productos." },
      { status: 400 },
    );
  }

  try {
    const access = await getBusinessAccessBySlug(businessSlug, sessionResult.session.userId);

    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a este negocio." },
        { status: 403 },
      );
    }

    const products = await getAdminProductsByBusinessId(access.businessId);
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los productos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionResult = await requireOperatorApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para crear producto no es valido." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "El payload del producto no es valido." },
      { status: 400 },
    );
  }

  try {
    const businessSlug =
      typeof (payload as { businessSlug?: unknown }).businessSlug === "string"
        ? (payload as { businessSlug: string }).businessSlug
        : "";
    const access = await getBusinessAccessBySlug(businessSlug, sessionResult.session.userId);

    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a este negocio." },
        { status: 403 },
      );
    }

    const product = await createProductInDatabase(
      {
        ...(payload as Omit<Parameters<typeof createProductInDatabase>[0], "businessId">),
        businessId: access.businessId,
      },
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el producto.";
    const statusCode = message.startsWith("Invalid product payload.")
      ? 400
      : message.startsWith("Ya existe")
        ? 409
        : message.startsWith("No encontramos el negocio")
          ? 404
        : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
