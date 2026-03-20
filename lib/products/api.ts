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
    id: string;
    orderCode?: string;
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
  businessId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder?: number;
}

export interface ProductApiUpdatePayload {
  businessId: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export async function fetchProductsByBusinessId(businessId: string) {
  const response = await fetch(`/api/products?businessId=${encodeURIComponent(businessId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = (await response.json()) as ProductsApiListResponse;
  return payload.products;
}

export async function createProductViaApi(payload: ProductApiCreatePayload) {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const result = (await response.json()) as ProductsApiMutationResponse;
  return result.product;
}

export async function updateProductViaApi(
  productId: string,
  payload: ProductApiUpdatePayload,
) {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const result = (await response.json()) as ProductsApiMutationResponse;
  return result.product;
}

export async function deleteProductViaApi(productId: string, businessId: string) {
  const response = await fetch(
    `/api/products/${encodeURIComponent(productId)}?businessId=${encodeURIComponent(businessId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as ProductDeleteResponse;
}
