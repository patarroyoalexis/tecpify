import { NextResponse } from "next/server";

import { debugError, debugLog } from "@/lib/debug";
import { requireOrderApiContext } from "@/lib/auth/server";
import { updateOrderInDatabase } from "@/lib/data/orders-server";

const UPDATE_ORDER_ALLOWED_FIELDS = new Set([
  "status",
  "paymentStatus",
  "customerName",
  "customerWhatsApp",
  "deliveryType",
  "deliveryAddress",
  "paymentMethod",
  "products",
  "notes",
  "total",
  "isReviewed",
  "history",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;

  if (!isUuidLike(orderId)) {
    return NextResponse.json(
      { error: "El orderId no tiene un formato valido." },
      { status: 400 },
    );
  }

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

  if (!isPlainObject(payload)) {
    return NextResponse.json(
      { error: "El payload para actualizar pedido debe ser un objeto JSON." },
      { status: 400 },
    );
  }

  const fieldsUpdated = Object.keys(payload);
  const invalidFields = fieldsUpdated.filter((field) => !UPDATE_ORDER_ALLOWED_FIELDS.has(field));

  if (invalidFields.length > 0) {
    return NextResponse.json(
      {
        error: `El payload para actualizar pedido contiene campos no permitidos: ${invalidFields.join(", ")}.`,
      },
      { status: 400 },
    );
  }

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
