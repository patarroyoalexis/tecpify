export interface LocalDeliveryPricingBand {
  upToKm: number;
  fee: number;
}

export interface BusinessLocalDeliverySettings {
  schemaStatus: "ready" | "missing_db_contract";
  isEnabled: boolean;
  originNeighborhoodId: string | null;
  maxDistanceKm: number | null;
  pricingBands: LocalDeliveryPricingBand[];
}

export interface LocalDeliveryNeighborhood {
  neighborhoodId: string;
  cityKey: string;
  cityName: string;
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface LocalDeliveryNeighborhoodOption {
  neighborhoodId: string;
  cityKey: string;
  cityName: string;
  name: string;
}

export type StorefrontLocalDeliveryStatus =
  | "available"
  | "disabled"
  | "missing_db_contract"
  | "missing_business_configuration"
  | "catalog_unavailable";

export interface StorefrontLocalDeliveryConfig {
  status: StorefrontLocalDeliveryStatus;
  isEnabled: boolean;
  destinationNeighborhoods: LocalDeliveryNeighborhoodOption[];
  message: string | null;
}

export type LocalDeliveryQuoteStatus =
  | "available"
  | "not_applicable"
  | "business_disabled"
  | "schema_not_ready"
  | "missing_business_configuration"
  | "catalog_unavailable"
  | "neighborhood_not_available"
  | "out_of_coverage";

export interface LocalDeliveryQuoteContext {
  originNeighborhoodId: string;
  originNeighborhoodName: string;
  destinationNeighborhoodId: string;
  destinationNeighborhoodName: string;
  cityKey: string;
  cityName: string;
  distanceKm: number;
  pricingBand: LocalDeliveryPricingBand;
}

export interface LocalDeliveryQuote {
  status: LocalDeliveryQuoteStatus;
  deliveryFee: number | null;
  message: string;
  context: LocalDeliveryQuoteContext | null;
}

export interface LocalDeliveryCatalogCityInput {
  cityKey: string;
  cityName: string;
  neighborhoods: LocalDeliveryCatalogNeighborhoodInput[];
}

export interface LocalDeliveryCatalogNeighborhoodInput {
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface LocalDeliveryCatalogImportDocument {
  cities: LocalDeliveryCatalogCityInput[];
}

export interface LocalDeliveryCatalogImportPreviewCity {
  cityKey: string;
  cityName: string;
  neighborhoodsCount: number;
}

export interface LocalDeliveryCatalogImportPreviewNeighborhood {
  cityKey: string;
  cityName: string;
  name: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
}

export interface LocalDeliveryCatalogImportValidationResult {
  ok: boolean;
  issues: string[];
  cities: LocalDeliveryCatalogImportPreviewCity[];
  neighborhoods: LocalDeliveryCatalogImportPreviewNeighborhood[];
}

export interface LocalDeliveryCatalogCitySummary {
  cityKey: string;
  cityName: string;
  activeNeighborhoodsCount: number;
  inactiveNeighborhoodsCount: number;
}

export interface LocalDeliveryAdminCatalogSnapshot {
  schemaStatus: "ready" | "missing_db_contract";
  totalNeighborhoods: number;
  activeNeighborhoods: number;
  cities: LocalDeliveryCatalogCitySummary[];
  message: string | null;
}
