import type { Order } from "@/types/orders";
import type { Product } from "@/types/products";

interface ProductsApiListResponse {
  products: Product[];
}

interface ProductsApiMutationResponse {
  product: Product;
}

interface ProductDeleteValidation {
  canDelete: boolean;
  referencedOrdersCount: number;
  sampleOrders: Array<{
    orderId: Order["orderId"];
    orderCode?: Order["orderCode"];
  }>;
}

interface ProductDeleteResponse {
  deletedProduct: Product;
  validation: ProductDeleteValidation;
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "No fue posible procesar la solicitud de productos.";
  } catch {
    return "No fue posible procesar la solicitud de productos.";
  }
}

export interface ProductApiCreatePayload {
  businessSlug: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder?: number;
}

export interface ProductApiUpdatePayload {
  businessSlug: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export async function fetchProductsByBusinessSlug(businessSlug: string) {
  let response: Response;

  try {
    response = await fetch(`/api/products?businessSlug=${encodeURIComponent(businessSlug)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No pudimos sincronizar el catalogo con el servidor. Revisa tu conexion e intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = (await response.json()) as ProductsApiListResponse;
  return payload.products;
}

export async function createProductViaApi(payload: ProductApiCreatePayload) {
  let response: Response;

  try {
    response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para crear el producto. Intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const result = (await response.json()) as ProductsApiMutationResponse;
  return result.product;
}

export async function updateProductViaApi(
  productId: Product["productId"],
  payload: ProductApiUpdatePayload,
) {
  let response: Response;

  try {
    response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para actualizar el producto. Intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const result = (await response.json()) as ProductsApiMutationResponse;
  return result.product;
}

export async function deleteProductViaApi(
  productId: Product["productId"],
  businessSlug: string,
) {
  let response: Response;

  try {
    response = await fetch(
      `/api/products/${encodeURIComponent(productId)}?businessSlug=${encodeURIComponent(businessSlug)}`,
      {
        method: "DELETE",
      },
    );
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para borrar el producto. Intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as ProductDeleteResponse;
}
