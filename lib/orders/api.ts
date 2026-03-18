import type { OrderApiCreatePayload, OrderApiUpdatePayload } from "@/lib/orders/mappers";
import { debugError, debugLog } from "@/lib/debug";
import type { Order } from "@/types/orders";

interface OrdersApiListResponse {
  orders: Order[];
}

interface OrdersApiCreateResponse {
  order: Order;
  orderCode?: string | null;
  persistedRemotely?: boolean;
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "No fue posible procesar la solicitud.";
  } catch {
    return "No fue posible procesar la solicitud.";
  }
}

export async function fetchOrdersByBusinessSlug(businessSlug: string) {
  const response = await fetch(`/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = (await response.json()) as OrdersApiListResponse;
  return payload.orders;
}

export async function createOrderViaApi(payload: OrderApiCreatePayload) {
  debugLog("[storefront] Creating order via API", {
    businessSlug: payload.businessSlug,
    productsCount: payload.products.length,
  });

  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);
  debugLog("[storefront] Orders API response received", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? (responseBody as { error?: string }).error
        : "No fue posible procesar la solicitud.";
    debugError("[storefront] Failed to create order via API", {
      status: response.status,
    });
    throw new Error(errorMessage ?? "No fue posible procesar la solicitud.");
  }

  const responsePayload = responseBody as OrdersApiCreateResponse;
  return responsePayload.order;
}

interface OrdersApiUpdateResponse {
  order: Order;
  persistedRemotely?: boolean;
}

export async function updateOrderViaApi(orderId: string, payload: OrderApiUpdatePayload) {
  debugLog("[dashboard] Updating order via API", {
    orderId,
    fieldsUpdated: Object.keys(payload ?? {}),
  });

  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);
  debugLog("[dashboard] Order PATCH response received", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? (responseBody as { error?: string }).error
        : "No fue posible procesar la actualizacion del pedido.";
    debugError("[dashboard] Failed to update order via API", {
      orderId,
      status: response.status,
      fieldsUpdated: Object.keys(payload ?? {}),
    });
    throw new Error(errorMessage ?? "No fue posible procesar la actualizacion del pedido.");
  }

  const responsePayload = responseBody as OrdersApiUpdateResponse;
  return responsePayload.order;
}
