import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product } from "@/types/products";
import type { BusinessProduct } from "@/types/storefront";

export async function getProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true });

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
