import type {
  DeliveryType,
  OrderProduct,
  PaymentMethod,
} from "@/types/orders";

export interface BusinessProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface BusinessConfig {
  slug: string;
  databaseId?: string | null;
  createdByUserId?: string | null;
  name: string;
  tagline: string;
  accent: string;
  availablePaymentMethods: PaymentMethod[];
  availableDeliveryTypes: DeliveryType[];
  products: BusinessProduct[];
}

export interface StorefrontOrder {
  id: string;
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  address?: string;
  observations?: string;
  status: string;
  createdAt: string;
}
