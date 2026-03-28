import { NextResponse } from "next/server";

import { debugError, debugLog } from "@/lib/debug";
import { requireBusinessSlug } from "@/lib/businesses/slug";
import { requireBusinessApiContext } from "@/lib/auth/server";
import { sanitizeClientCreateOrderPayload } from "@/lib/orders/state-rules";
import {
  createOrderInDatabase,
  getOrdersByBusinessIdFromDatabase,
} from "@/lib/data/orders-server";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

interface OrdersRouteDependencies {
  requireBusinessSlug: typeof requireBusinessSlug;
  requireBusinessApiContext: typeof requireBusinessApiContext;
  getOrdersByBusinessIdFromDatabase: typeof getOrdersByBusinessIdFromDatabase;
  createOrderInDatabase: typeof createOrderInDatabase;
}

export function createOrdersRouteHandlers(
  dependencies: OrdersRouteDependencies = {
    requireBusinessSlug,
    requireBusinessApiContext,
    getOrdersByBusinessIdFromDatabase,
    createOrderInDatabase,
  },
) {
  return {
    async GET(request: Request) {
      const { searchParams } = new URL(request.url);
      const rawBusinessSlug = searchParams.get("businessSlug");
      let businessSlug = "";

      try {
        businessSlug = rawBusinessSlug ? dependencies.requireBusinessSlug(rawBusinessSlug) : "";
      } catch {
        businessSlug = "";
      }

      if (!businessSlug) {
        return NextResponse.json(
          { error: "Debes indicar el businessSlug para consultar pedidos." },
          { status: 400 },
        );
      }

      const businessContextResult = await dependencies.requireBusinessApiContext(businessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      try {
        const orders = await dependencies.getOrdersByBusinessIdFromDatabase(
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
    },
    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "El body JSON para crear pedido no es valido." },
          { status: 400 },
        );
      }

      if (!isPlainObject(payload)) {
        return NextResponse.json(
          { error: "El payload para crear pedido debe ser un objeto JSON." },
          { status: 400 },
        );
      }

      const payloadFields = Object.keys(payload);
      const {
        sanitizedPayload,
        invalidFields,
        ignoredDerivedFields,
      } = sanitizeClientCreateOrderPayload(payload);

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `El payload para crear pedido contiene campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      let normalizedBusinessSlug = "";

      try {
        normalizedBusinessSlug =
          typeof sanitizedPayload.businessSlug === "string"
            ? dependencies.requireBusinessSlug(sanitizedPayload.businessSlug)
            : "";
      } catch {
        normalizedBusinessSlug = "";
      }

      if (!normalizedBusinessSlug) {
        return NextResponse.json(
          { error: "businessSlug es obligatorio y debe ser valido." },
          { status: 400 },
        );
      }

      try {
        const order = await dependencies.createOrderInDatabase({
          ...sanitizedPayload,
          businessSlug: normalizedBusinessSlug,
        }, { origin: "public_form" });
        const responsePayload = {
          order,
          orderCode: order.orderCode ?? null,
          persistedRemotely: true,
        };
        debugLog("[orders-api] Created order", {
          orderId: order.orderId,
          hasOrderCode: Boolean(order.orderCode),
          persistedRemotely: true,
          ignoredDerivedFields,
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
              : message.includes("is blocked until it has a real owner")
                ? 403
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
    },
  };
}

const ordersRouteHandlers = createOrdersRouteHandlers();

export const GET = ordersRouteHandlers.GET;
export const POST = ordersRouteHandlers.POST;
