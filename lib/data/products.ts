import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
} from "@/lib/supabase/server";
import {
  requireBusinessId,
  requireProductId,
  type BusinessId,
  type ProductId,
} from "@/types/identifiers";
import type { Product, ProductRow } from "@/types/products";
import type { BusinessProduct } from "@/types/storefront";

interface ProductCreatePayload {
  businessId: BusinessId;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

interface ProductUpdatePayload {
  businessId: BusinessId;
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface ProductDeleteValidation {
  canDelete: boolean;
  referencedOrdersCount: number;
  sampleOrders: Array<{
    orderId: string;
    orderCode?: string;
  }>;
}

export interface ProductDeleteResult {
  deletedProduct: Product;
  validation: ProductDeleteValidation;
}

function isValidStorefrontProduct(product: Product) {
  return (
    typeof product.name === "string" &&
    product.name.trim().length > 0 &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    product.isAvailable === true
  );
}

function mapProductRow(row: ProductRow): Product {
  return {
    productId: requireProductId(row.id),
    businessId: requireBusinessId(row.business_id),
    name: row.name,
    description: row.description,
    price: row.price,
    isAvailable: row.is_available,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProductsByBusinessId(businessId: BusinessId): Promise<Product[]> {
  const normalizedBusinessId = requireBusinessId(businessId);
  const supabase = createServerSupabasePublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", normalizedBusinessId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase products query failed: ${error.message}`);
  }

  return ((data ?? []) as ProductRow[]).map(mapProductRow).filter(isValidStorefrontProduct);
}

export async function getAdminProductsByBusinessId(businessId: BusinessId): Promise<Product[]> {
  const normalizedBusinessId = requireBusinessId(businessId);
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", normalizedBusinessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase products query failed: ${error.message}`);
  }

  return ((data ?? []) as ProductRow[]).map(mapProductRow);
}

export function mapProductToBusinessProduct(product: Product): BusinessProduct {
  return {
    productId: product.productId,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder ?? 0,
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
  const normalizedName = normalizeProductName(name);

  if (!normalizedName) {
    throw new Error("Invalid product payload. name es obligatorio.");
  }

  if (normalizedName.length > 120) {
    throw new Error("Invalid product payload. name no puede superar 120 caracteres.");
  }
}

function assertValidProductPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid product payload. price debe ser un numero valido mayor o igual a 0.");
  }
}

function assertValidSortOrder(sortOrder: number | undefined) {
  if (sortOrder === undefined) {
    return;
  }

  if (!Number.isFinite(sortOrder) || sortOrder < 1) {
    throw new Error("Invalid product payload. sortOrder debe ser un numero mayor o igual a 1.");
  }
}

function assertAtLeastOneProductField(payload: ProductUpdatePayload) {
  const hasMutableField = [
    "name",
    "description",
    "price",
    "isAvailable",
    "isFeatured",
    "sortOrder",
  ].some((field) => payload[field as keyof ProductUpdatePayload] !== undefined);

  if (!hasMutableField) {
    throw new Error(
      "Invalid product payload. Debes enviar al menos un campo editable para actualizar.",
    );
  }
}

function resolveDesiredSortOrder(sortOrder: number | undefined, fallbackCount: number) {
  if (sortOrder === undefined || !Number.isFinite(sortOrder)) {
    return fallbackCount + 1;
  }

  return Math.max(1, Math.floor(sortOrder));
}

function moveProductId(ids: ProductId[], productId: ProductId, desiredSortOrder: number) {
  const remainingIds = ids.filter((id) => id !== productId);
  const targetIndex = Math.min(Math.max(desiredSortOrder - 1, 0), remainingIds.length);
  remainingIds.splice(targetIndex, 0, productId);
  return remainingIds;
}

async function writeNormalizedSortOrders(businessId: BusinessId, orderedIds: ProductId[]) {
  const normalizedBusinessId = requireBusinessId(businessId);
  const supabase = await createServerSupabaseAuthClient();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const temporarySortOrder = -100000 - index;
    const { error } = await supabase
      .from("products")
      .update({
        sort_order: temporarySortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", normalizedBusinessId)
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
      .eq("business_id", normalizedBusinessId)
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase products reorder failed: ${error.message}`);
    }
  }
}

function mapSupabaseProductError(error: { code?: string; message: string }) {
  if (error.message.startsWith("No puedes borrar")) {
    return error.message;
  }

  if (error.code === "23505") {
    return "Ya existe un producto con ese nombre u orden dentro de este negocio.";
  }

  if (error.code === "23503") {
    return "No encontramos el negocio asociado a este producto. Recarga la vista e intenta de nuevo.";
  }

  return `Supabase products mutation failed: ${error.message}`;
}

export async function createProductInDatabase(payload: ProductCreatePayload): Promise<Product> {
  const businessId = requireBusinessId(payload.businessId);
  assertValidProductName(payload.name);
  assertValidProductPrice(payload.price);
  assertValidSortOrder(payload.sortOrder);

  const currentProducts = await getAdminProductsByBusinessId(businessId);
  const nextSortOrder = resolveDesiredSortOrder(payload.sortOrder, currentProducts.length);
  const now = new Date().toISOString();
  const productId = requireProductId(crypto.randomUUID());
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      id: productId,
      business_id: businessId,
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
    [...currentProducts.map((product) => product.productId), productId],
    productId,
    nextSortOrder,
  );

  await writeNormalizedSortOrders(businessId, orderedIds);

  const updatedProducts = await getAdminProductsByBusinessId(businessId);
  const createdProduct = updatedProducts.find((product) => product.productId === productId);

  if (!createdProduct) {
    throw new Error("No fue posible recuperar el producto creado.");
  }

  return createdProduct ?? mapProductRow(data as ProductRow);
}

export async function updateProductInDatabase(
  productId: ProductId,
  payload: ProductUpdatePayload,
): Promise<Product> {
  const normalizedBusinessId = requireBusinessId(payload.businessId);
  const normalizedProductId = requireProductId(productId);
  assertAtLeastOneProductField(payload);
  const currentProducts = await getAdminProductsByBusinessId(normalizedBusinessId);
  const existingProduct = currentProducts.find((product) => product.productId === normalizedProductId);

  if (!existingProduct) {
    throw new Error(`Product not found for id "${normalizedProductId}".`);
  }

  if (payload.name !== undefined) {
    assertValidProductName(payload.name);
  }

  if (payload.price !== undefined) {
    assertValidProductPrice(payload.price);
  }

  assertValidSortOrder(payload.sortOrder);

  const desiredSortOrder =
    payload.sortOrder === undefined
      ? existingProduct.sortOrder ?? currentProducts.length
      : Math.max(1, Math.floor(payload.sortOrder));

  const currentOrder = currentProducts.map((product) => product.productId);
  const reorderedIds = moveProductId(currentOrder, normalizedProductId, desiredSortOrder);
  const didReorder = reorderedIds.some((id, index) => id !== currentOrder[index]);

  if (didReorder) {
    await writeNormalizedSortOrders(normalizedBusinessId, reorderedIds);
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: payload.name === undefined ? existingProduct.name : normalizeProductName(payload.name),
      description:
        payload.description === undefined
          ? existingProduct.description
          : normalizeDescription(payload.description),
      price: payload.price ?? existingProduct.price,
      is_available: payload.isAvailable ?? existingProduct.isAvailable,
      is_featured: payload.isFeatured ?? existingProduct.isFeatured,
      sort_order: reorderedIds.findIndex((id) => id === normalizedProductId) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", normalizedBusinessId)
    .eq("id", normalizedProductId)
    .select("*")
    .single();

  if (error) {
    throw new Error(mapSupabaseProductError(error));
  }

  return mapProductRow(data as ProductRow);
}

export async function deleteProductInDatabase(
  productId: ProductId,
  businessId: BusinessId,
): Promise<ProductDeleteResult> {
  const normalizedBusinessId = requireBusinessId(businessId);
  const normalizedProductId = requireProductId(productId);
  const currentProducts = await getAdminProductsByBusinessId(normalizedBusinessId);
  const existingProduct = currentProducts.find((product) => product.productId === normalizedProductId);

  if (!existingProduct) {
    throw new Error(`Product not found for id "${normalizedProductId}".`);
  }

  const supabase = await createServerSupabaseAuthClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("business_id", normalizedBusinessId)
    .eq("id", normalizedProductId);

  if (error) {
    throw new Error(mapSupabaseProductError(error));
  }

  const remainingIds = currentProducts
    .filter((product) => product.productId !== normalizedProductId)
    .map((product) => product.productId);

  if (remainingIds.length > 0) {
    await writeNormalizedSortOrders(normalizedBusinessId, remainingIds);
  }

  return {
    deletedProduct: existingProduct,
    validation: {
      canDelete: true,
      referencedOrdersCount: 0,
      sampleOrders: [],
    },
  };
}
