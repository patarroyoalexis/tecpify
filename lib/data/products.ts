import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
} from "@/lib/supabase/server";
import type { Product } from "@/types/products";
import type { BusinessProduct } from "@/types/storefront";
import { getOrderDisplayCode, type OrderProduct } from "@/types/orders";

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

interface ProductUsageOrderReference {
  id: string;
  orderCode?: string;
}

export interface ProductDeleteValidation {
  canDelete: boolean;
  referencedOrdersCount: number;
  sampleOrders: ProductUsageOrderReference[];
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
    product.is_available === true
  );
}

export async function getProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = createServerSupabasePublicClient();
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
  const supabase = await createServerSupabaseAuthClient();
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
  const normalizedName = normalizeProductName(name);

  if (!normalizedName) {
    throw new Error("Invalid product payload. name es obligatorio.");
  }

  if (normalizedName.length > 120) {
    throw new Error("Invalid product payload. name no puede superar 120 caracteres.");
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

function moveProductId(ids: string[], productId: string, desiredSortOrder: number) {
  const remainingIds = ids.filter((id) => id !== productId);
  const targetIndex = Math.min(Math.max(desiredSortOrder - 1, 0), remainingIds.length);
  remainingIds.splice(targetIndex, 0, productId);
  return remainingIds;
}

async function writeNormalizedSortOrders(businessId: string, orderedIds: string[]) {
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

  if (error.code === "23503") {
    return "No encontramos el negocio asociado a este producto. Recarga la vista e intenta de nuevo.";
  }

  return `Supabase products mutation failed: ${error.message}`;
}

function readOrderProducts(value: unknown): OrderProduct[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const quantity =
      typeof candidate.quantity === "number"
        ? candidate.quantity
        : typeof candidate.quantity === "string"
          ? Number(candidate.quantity)
          : 0;
    const productId =
      typeof candidate.productId === "string"
        ? candidate.productId
        : typeof candidate.product_id === "string"
          ? candidate.product_id
          : undefined;

    if (!name || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{ name, quantity, ...(productId ? { productId } : {}) }];
  });
}

async function getProductUsageValidation(
  businessId: string,
  productId: string,
): Promise<ProductDeleteValidation> {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, products")
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Supabase product usage lookup failed: ${error.message}`);
  }

  const matchingOrders = ((data ?? []) as Record<string, unknown>[]).filter((order) =>
    readOrderProducts(order.products).some((product) => product.productId === productId),
  );

  return {
    canDelete: matchingOrders.length === 0,
    referencedOrdersCount: matchingOrders.length,
    sampleOrders: matchingOrders.slice(0, 3).map((order) => ({
      id: typeof order.id === "string" ? order.id : "",
      orderCode:
        typeof order.order_code === "string"
          ? getOrderDisplayCode({ id: typeof order.id === "string" ? order.id : "", orderCode: order.order_code })
          : undefined,
    })),
  };
}

export async function createProductInDatabase(payload: ProductCreatePayload): Promise<Product> {
  assertValidBusinessId(payload.businessId);
  assertValidProductName(payload.name);
  assertValidProductPrice(payload.price);
  assertValidSortOrder(payload.sortOrder);

  const currentProducts = await getAdminProductsByBusinessId(payload.businessId);
  const nextSortOrder = resolveDesiredSortOrder(payload.sortOrder, currentProducts.length);
  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const supabase = await createServerSupabaseAuthClient();
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
  assertAtLeastOneProductField(payload);
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

  assertValidSortOrder(payload.sortOrder);

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

export async function deleteProductInDatabase(
  productId: string,
  businessId: string,
): Promise<ProductDeleteResult> {
  assertValidBusinessId(businessId);
  const currentProducts = await getAdminProductsByBusinessId(businessId);
  const existingProduct = currentProducts.find((product) => product.id === productId);

  if (!existingProduct) {
    throw new Error(`Product not found for id "${productId}".`);
  }

  const validation = await getProductUsageValidation(businessId, productId);

  if (!validation.canDelete) {
    throw new Error(
      `No puedes borrar "${existingProduct.name}" porque ya aparece en ${validation.referencedOrdersCount} pedido${validation.referencedOrdersCount === 1 ? "" : "s"} real${validation.referencedOrdersCount === 1 ? "" : "es"}. Desactivalo en lugar de borrarlo.`,
    );
  }

  const supabase = await createServerSupabaseAuthClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("business_id", businessId)
    .eq("id", productId);

  if (error) {
    throw new Error(mapSupabaseProductError(error));
  }

  const remainingIds = currentProducts
    .filter((product) => product.id !== productId)
    .map((product) => product.id);

  if (remainingIds.length > 0) {
    await writeNormalizedSortOrders(businessId, remainingIds);
  }

  return {
    deletedProduct: existingProduct,
    validation,
  };
}
