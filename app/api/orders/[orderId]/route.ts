import { NextResponse } from "next/server";

import { updateOrderInDatabase } from "@/lib/data/orders-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body for order update." },
      { status: 400 },
    );
  }

  console.info("[orders-api] PATCH /api/orders/[orderId] payload", {
    orderId,
    payload,
  });

  try {
    const order = await updateOrderInDatabase(orderId, payload);
    return NextResponse.json({ order, persistedRemotely: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar el pedido.";
    const statusCode =
      message.startsWith("Invalid order update payload.")
        ? 400
        : message.startsWith("Order not found")
          ? 404
          : 500;

    console.error("[orders-api] PATCH /api/orders/[orderId] failed", {
      orderId,
      statusCode,
      message,
      payload,
    });

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
