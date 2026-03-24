import { NextResponse } from "next/server";

import { debugError, debugLog } from "@/lib/debug";
import { requireBusinessApiContext } from "@/lib/auth/server";
import {
  createOrderInDatabase,
  getOrdersByBusinessIdFromDatabase,
} from "@/lib/data/orders-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessSlug = searchParams.get("businessSlug")?.trim();

  if (!businessSlug) {
    return NextResponse.json(
      { error: "Debes indicar el businessSlug para consultar pedidos." },
      { status: 400 },
    );
  }

  const businessContextResult = await requireBusinessApiContext(businessSlug);

  if (!businessContextResult.ok) {
    return businessContextResult.response;
  }

  try {
    const orders = await getOrdersByBusinessIdFromDatabase(
      businessContextResult.context.businessId,
      {
        businessSlug: businessContextResult.context.businessSlug,
      },
    );
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
      { error: "El body JSON para crear pedido no es valido." },
      { status: 400 },
    );
  }
  const payloadFields =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload as Record<string, unknown>)
      : [];

  try {
    const order = await createOrderInDatabase(payload);
    const responsePayload = {
      order,
      orderCode: order.orderCode ?? null,
      persistedRemotely: true,
    };
    debugLog("[orders-api] Created order", {
      orderId: order.id,
      hasOrderCode: Boolean(order.orderCode),
      persistedRemotely: true,
    });
    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible guardar el pedido.";
    const statusCode =
      message.startsWith("Invalid order payload.")
        ? 400
        : message.startsWith("Business not found")
          ? 404
          : message.includes("no existe") || message.includes("no esta activo")
            ? 409
          : 500;

    debugError("[orders-api] Failed to create order", {
      statusCode,
      message,
      payloadFields,
    });

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
