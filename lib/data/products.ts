import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types/products";
import type { BusinessProduct } from "@/types/storefront";

interface ProductCreatePayload {
  businessId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

interface ProductUpdatePayload {
  businessId: string;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

function isValidStorefrontProduct(product: Product) {
  return (
    typeof product.name === "string" &&
    product.name.trim().length > 0 &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    product.is_available === true
  );
}

export async function getProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase products query failed: ${error.message}`);
  }

  return ((data ?? []) as Product[]).filter(isValidStorefrontProduct);
}

export async function getAdminProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase products query failed: ${error.message}`);
  }

  return (data ?? []) as Product[];
}

export function mapProductToBusinessProduct(product: Product): BusinessProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    isAvailable: product.is_available,
    isFeatured: product.is_featured,
    sortOrder: product.sort_order ?? 0,
  };
}

function normalizeProductName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeDescription(description?: string) {
  const trimmed = description?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function assertValidProductName(name: string) {
  if (!normalizeProductName(name)) {
    throw new Error("Invalid product payload. name es obligatorio.");
  }
}

function assertValidBusinessId(businessId: string) {
  if (typeof businessId !== "string" || businessId.trim().length === 0) {
    throw new Error("Invalid product payload. businessId es obligatorio.");
  }
}

function assertValidProductPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid product payload. price debe ser un numero valido mayor o igual a 0.");
  }
}

function resolveDesiredSortOrder(sortOrder: number | undefined, fallbackCount: number) {
  if (sortOrder === undefined || !Number.isFinite(sortOrder)) {
    return fallbackCount + 1;
  }

  return Math.max(1, Math.floor(sortOrder));
}

function moveProductId(ids: string[], productId: string, desiredSortOrder: number) {
  const remainingIds = ids.filter((id) => id !== productId);
  const targetIndex = Math.min(Math.max(desiredSortOrder - 1, 0), remainingIds.length);
  remainingIds.splice(targetIndex, 0, productId);
  return remainingIds;
}

async function writeNormalizedSortOrders(businessId: string, orderedIds: string[]) {
  const supabase = createServerSupabaseClient();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const temporarySortOrder = -100000 - index;
    const { error } = await supabase
      .from("products")
      .update({
        sort_order: temporarySortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase products reorder failed: ${error.message}`);
    }
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const finalSortOrder = index + 1;
    const { error } = await supabase
      .from("products")
      .update({
        sort_order: finalSortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase products reorder failed: ${error.message}`);
    }
  }
}

function mapSupabaseProductError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return "Ya existe un producto con ese nombre u orden dentro de este negocio.";
  }

  return `Supabase products mutation failed: ${error.message}`;
}

export async function createProductInDatabase(payload: ProductCreatePayload): Promise<Product> {
  assertValidBusinessId(payload.businessId);
  assertValidProductName(payload.name);
  assertValidProductPrice(payload.price);

  const currentProducts = await getAdminProductsByBusinessId(payload.businessId);
  const nextSortOrder = resolveDesiredSortOrder(payload.sortOrder, currentProducts.length);
  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      id: productId,
      business_id: payload.businessId,
      name: normalizeProductName(payload.name),
      description: normalizeDescription(payload.description),
      price: payload.price,
      is_available: payload.isAvailable ?? true,
      is_featured: payload.isFeatured ?? false,
      sort_order: currentProducts.length + 1,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseProductError(error));
  }

  const orderedIds = moveProductId(
    [...currentProducts.map((product) => product.id), productId],
    productId,
    nextSortOrder,
  );

  await writeNormalizedSortOrders(payload.businessId, orderedIds);

  const updatedProducts = await getAdminProductsByBusinessId(payload.businessId);
  const createdProduct = updatedProducts.find((product) => product.id === productId);

  if (!createdProduct) {
    throw new Error("No fue posible recuperar el producto creado.");
  }

  return createdProduct ?? (data as Product);
}

export async function updateProductInDatabase(
  productId: string,
  payload: ProductUpdatePayload,
): Promise<Product> {
  assertValidBusinessId(payload.businessId);
  const currentProducts = await getAdminProductsByBusinessId(payload.businessId);
  const existingProduct = currentProducts.find((product) => product.id === productId);

  if (!existingProduct) {
    throw new Error(`Product not found for id "${productId}".`);
  }

  if (payload.name !== undefined) {
    assertValidProductName(payload.name);
  }

  if (payload.price !== undefined) {
    assertValidProductPrice(payload.price);
  }

  const desiredSortOrder =
    payload.sortOrder === undefined
      ? existingProduct.sort_order ?? currentProducts.length
      : Math.max(1, Math.floor(payload.sortOrder));

  const currentOrder = currentProducts.map((product) => product.id);
  const reorderedIds = moveProductId(currentOrder, productId, desiredSortOrder);
  const didReorder = reorderedIds.some((id, index) => id !== currentOrder[index]);

  if (didReorder) {
    await writeNormalizedSortOrders(payload.businessId, reorderedIds);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: payload.name === undefined ? existingProduct.name : normalizeProductName(payload.name),
      description:
        payload.description === undefined
          ? existingProduct.description
          : normalizeDescription(payload.description),
      price: payload.price ?? existingProduct.price,
      is_available: payload.isAvailable ?? existingProduct.is_available,
      is_featured: payload.isFeatured ?? existingProduct.is_featured,
      sort_order: reorderedIds.findIndex((id) => id === productId) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", payload.businessId)
    .eq("id", productId)
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseProductError(error));
  }

  return data as Product;
}
