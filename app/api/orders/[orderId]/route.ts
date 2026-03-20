import { NextResponse } from "next/server";

import {
  canOperatorAccessBusiness,
  getBusinessAccessRecordByOrderId,
} from "@/lib/auth/business-access";
import { requireOperatorApiSession } from "@/lib/auth/server";
import { debugError, debugLog } from "@/lib/debug";
import { updateOrderInDatabase } from "@/lib/data/orders-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
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
      { error: "Invalid JSON body for order update." },
      { status: 400 },
    );
  }
  const fieldsUpdated =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload as Record<string, unknown>)
      : [];

  try {
    const accessRecord = await getBusinessAccessRecordByOrderId(orderId);

    if (accessRecord && !canOperatorAccessBusiness(session, accessRecord)) {
      return NextResponse.json(
        { error: "No tienes acceso operativo a este negocio." },
        { status: 403 },
      );
    }

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
