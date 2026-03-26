import type {
  OrderApiUpdatePayload,
  PublicOrderApiCreatePayload,
  WorkspaceOrderApiCreatePayload,
} from "@/lib/orders/mappers";
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

async function createOrderRequest(
  path: string,
  payload: PublicOrderApiCreatePayload | WorkspaceOrderApiCreatePayload,
  options: {
    requestLogLabel: string;
    errorLogLabel: string;
    networkErrorMessage: string;
  },
) {
  debugLog(options.requestLogLabel, {
    businessSlug: payload.businessSlug,
    productsCount: payload.products.length,
  });

  let response: Response;

  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(options.networkErrorMessage);
  }

  const responseBody = await response.json().catch(() => null);
  debugLog(`${options.requestLogLabel} response received`, {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? (responseBody as { error?: string }).error
        : "No fue posible procesar la solicitud.";
    debugError(options.errorLogLabel, {
      status: response.status,
      businessSlug: payload.businessSlug,
    });
    throw new Error(errorMessage ?? "No fue posible procesar la solicitud.");
  }

  const responsePayload = responseBody as OrdersApiCreateResponse;
  return responsePayload.order;
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
  let response: Response;

  try {
    response = await fetch(`/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No pudimos sincronizar los pedidos con el servidor. Revisa tu conexion e intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = (await response.json()) as OrdersApiListResponse;
  return payload.orders;
}

export async function createStorefrontOrderViaApi(payload: PublicOrderApiCreatePayload) {
  return createOrderRequest("/api/orders", payload, {
    requestLogLabel: "[storefront] Creating order via API",
    errorLogLabel: "[storefront] Failed to create order via API",
    networkErrorMessage:
      "No pudimos conectar con el servidor para guardar el pedido. Revisa tu conexion e intenta de nuevo.",
  });
}

export async function createWorkspaceOrderViaApi(payload: WorkspaceOrderApiCreatePayload) {
  return createOrderRequest("/api/orders/private", payload, {
    requestLogLabel: "[dashboard] Creating workspace order via API",
    errorLogLabel: "[dashboard] Failed to create workspace order via API",
    networkErrorMessage:
      "No pudimos conectar con el servidor para guardar el pedido manual. Revisa tu conexion e intenta de nuevo.",
  });
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

  let response: Response;

  try {
    response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para actualizar el pedido. Revisa tu conexion e intenta de nuevo.",
    );
  }

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
