import { NextResponse } from "next/server";

import {
  createOrderInDatabase,
  getBusinessDatabaseRecordBySlug,
  getOrdersByBusinessSlugFromDatabase,
} from "@/lib/data/orders-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessSlug = searchParams.get("businessSlug")?.trim();

  if (!businessSlug) {
    return NextResponse.json(
      { error: "Missing required query parameter: businessSlug." },
      { status: 400 },
    );
  }

  try {
    const business = await getBusinessDatabaseRecordBySlug(businessSlug);

    if (!business) {
      return NextResponse.json(
        { error: `No existe un negocio activo para el slug "${businessSlug}".` },
        { status: 404 },
      );
    }

    const orders = await getOrdersByBusinessSlugFromDatabase(businessSlug);
    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar los pedidos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body for order creation." },
      { status: 400 },
    );
  }

  console.info("[orders-api] POST /api/orders payload", payload);

  try {
    const order = await createOrderInDatabase(payload);
    const responsePayload = {
      order,
      orderCode: order.orderCode ?? null,
      persistedRemotely: true,
    };
    console.info("[orders-api] POST /api/orders response", responsePayload);
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible guardar el pedido.";
    const statusCode =
      message.startsWith("Invalid order payload.")
        ? 400
        : message.startsWith("Business not found")
          ? 404
          : 500;

    console.error("[orders-api] POST /api/orders failed", {
      statusCode,
      message,
      payload,
    });

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
