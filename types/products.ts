export interface Product {
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
