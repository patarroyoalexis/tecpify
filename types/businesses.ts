import type { BusinessId, BusinessSlug } from "@/types/identifiers";

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
}