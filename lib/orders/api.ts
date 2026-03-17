import type { OrderApiCreatePayload } from "@/lib/orders/mappers";
import type { Order } from "@/types/orders";

interface OrdersApiListResponse {
  orders: Order[];
}

interface OrdersApiCreateResponse {
  order: Order;
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
  console.info("[storefront] orders API payload", payload);

  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);
  console.info("[storefront] orders API response", {
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? (responseBody as { error?: string }).error
        : "No fue posible procesar la solicitud.";
    throw new Error(errorMessage ?? "No fue posible procesar la solicitud.");
  }

  const responsePayload = responseBody as OrdersApiCreateResponse;
  return responsePayload.order;
}
