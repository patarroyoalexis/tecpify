import type {
  DeliveryType,
  OrderProduct,
  PaymentMethod,
} from "@/types/orders";
import type { BusinessId, BusinessSlug, OrderId, ProductId } from "@/types/identifiers";
import type { StorefrontLocalDeliveryConfig } from "@/types/local-delivery";

export interface BusinessProduct {
  productId: ProductId;
  name: string;
  description: string;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface BusinessConfig {
  businessSlug: BusinessSlug;
  businessId?: BusinessId | null;
  name: string;
  tagline: string;
  accent: string;
  availablePaymentMethods: PaymentMethod[];
  availableDeliveryTypes: DeliveryType[];
  localDelivery: StorefrontLocalDeliveryConfig;
  products: BusinessProduct[];
}

export interface StorefrontOrder {
  orderId: OrderId;
  businessId: BusinessId;
  businessName: string;
  customerName: string;
  customerPhone: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  deliveryFee?: number;
  address?: string;
  observations?: string;
  status: string;
  createdAt: string;
}
