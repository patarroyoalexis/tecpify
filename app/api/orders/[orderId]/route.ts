import { NextResponse } from "next/server";

import { debugError, debugLog } from "@/lib/debug";
import { requireOrderApiContext } from "@/lib/auth/server";
import { updateOrderInDatabase } from "@/lib/data/orders-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const orderContextResult = await requireOrderApiContext(orderId);

  if (!orderContextResult.ok) {
    return orderContextResult.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El body JSON para actualizar pedido no es valido." },
      { status: 400 },
    );
  }
  const fieldsUpdated =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload as Record<string, unknown>)
      : [];

  try {
    const order = await updateOrderInDatabase(orderId, payload);
    debugLog("[orders-api] Updated order", { orderId, fieldsUpdated });
    return NextResponse.json({ order, persistedRemotely: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar el pedido.";
    const statusCode =
      message.startsWith("Invalid order update payload.")
        ? 400
        : message.startsWith("Order not found")
          ? 404
          : message.includes("no existe")
            ? 409
            : 500;

    debugError("[orders-api] Failed to update order", {
      orderId,
      statusCode,
      message,
      fieldsUpdated,
    });

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
