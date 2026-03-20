import { NextResponse } from "next/server";

import {
  canOperatorAccessBusiness,
  getBusinessAccessRecordById,
} from "@/lib/auth/business-access";
import { getOperatorSession } from "@/lib/auth/server";
import {
  createProductInDatabase,
  getAdminProductsByBusinessId,
} from "@/lib/data/products";

export async function GET(request: Request) {
  const session = await getOperatorSession();

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId")?.trim();

  if (!businessId) {
    return NextResponse.json(
      { error: "Missing required query parameter: businessId." },
      { status: 400 },
    );
  }

  try {
    const accessRecord = await getBusinessAccessRecordById(businessId);

    if (accessRecord && session && !canOperatorAccessBusiness(session, accessRecord)) {
      return NextResponse.json(
        { error: "No tienes acceso operativo a este negocio." },
        { status: 403 },
      );
    }

    const products = await getAdminProductsByBusinessId(businessId);
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
  const session = await getOperatorSession();

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body for product creation." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid product payload." },
      { status: 400 },
    );
  }

  try {
    const businessId =
      typeof (payload as { businessId?: unknown }).businessId === "string"
        ? (payload as { businessId: string }).businessId
        : "";
    const accessRecord = businessId
      ? await getBusinessAccessRecordById(businessId)
      : null;

    if (accessRecord && session && !canOperatorAccessBusiness(session, accessRecord)) {
      return NextResponse.json(
        { error: "No tienes acceso operativo a este negocio." },
        { status: 403 },
      );
    }

    const product = await createProductInDatabase(
      payload as Parameters<typeof createProductInDatabase>[0],
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el producto.";
    const statusCode = message.startsWith("Invalid product payload.")
      ? 400
      : message.startsWith("Ya existe")
        ? 409
        : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
