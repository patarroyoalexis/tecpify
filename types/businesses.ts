import type { BusinessId, BusinessSlug } from "@/types/identifiers";

export interface BusinessPaymentSettings {
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
}

export interface BusinessRecord {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  name: string;
  transferInstructions: string | null;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
}

export interface OwnedBusinessSummary {
  businessId: BusinessId;
  businessSlug: BusinessSlug;
  businessName: string;
  updatedAt: string;
  createdByUserId: string;
}

export interface CreateBusinessPayload {
  name: string;
  businessSlug: string;
}

export interface UpdateBusinessSettingsPayload extends BusinessPaymentSettings {
  businessSlug: string;
  transferInstructions: string;
}
