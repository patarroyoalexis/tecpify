import type { BusinessId, BusinessSlug } from "@/types/identifiers";
import type { BusinessLocalDeliverySettings, LocalDeliveryPricingBand } from "@/types/local-delivery";

export interface BusinessPaymentSettings {
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
}

export interface BusinessRecord extends BusinessPaymentSettings {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  name: string;
  businessType: string | null;
  transferInstructions: string | null;
  localDeliverySettings: BusinessLocalDeliverySettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
}

export interface OwnedBusinessSummary {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  businessName: string;
  isActive: boolean;
  updatedAt: string;
  createdByUserId: string;
}

export interface CreateBusinessPayload {
  name: string;
  businessSlug: string;
  businessType?: string;
}

export interface UpdateBusinessSettingsPayload extends BusinessPaymentSettings {
  businessSlug: string;
  transferInstructions: string;
  localDeliveryEnabled?: boolean;
  localDeliveryOriginNeighborhoodId?: string | null;
  localDeliveryMaxDistanceKm?: number | null;
  localDeliveryPricingBands?: LocalDeliveryPricingBand[];
}
