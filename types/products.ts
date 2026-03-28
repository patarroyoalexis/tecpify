import type { BusinessId, ProductId } from "@/types/identifiers";

export interface Product {
  productId: ProductId;
  businessId: BusinessId;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}
