export type ServiceRoleUsageClassification =
  | "indispensable"
  | "reemplazable"
  | "mal_justificado";

export interface ServiceRoleUsageInventoryEntry {
  id: string;
  status: "active" | "disabled";
  classification: ServiceRoleUsageClassification;
  location: string;
  summary: string;
}

export const SERVICE_ROLE_USAGE_INVENTORY = [
  {
    id: "public_business_lookup",
    status: "disabled",
    classification: "reemplazable",
    location: "data/businesses.ts#getBusinessBySlugFromDatabase",
    summary: "Reemplazado por lectura publica de businesses con RLS limitada a negocios con owner.",
  },
  {
    id: "public_order_business_lookup",
    status: "disabled",
    classification: "reemplazable",
    location: "lib/data/orders-server.ts#getBusinessDatabaseRecordBySlug",
    summary: "Reemplazado por lectura publica de businesses con RLS limitada a negocios con owner.",
  },
  {
    id: "public_order_code_precheck",
    status: "disabled",
    classification: "reemplazable",
    location: "lib/data/orders-server.ts#generateUniqueOrderCode",
    summary: "Reemplazado por retry sobre insert publico y constraint unica de order_code.",
  },
  {
    id: "public_order_read_after_write",
    status: "disabled",
    classification: "reemplazable",
    location: "lib/data/orders-server.ts#createOrderInDatabase",
    summary: "Reemplazado por mapper server-side del payload persistido ya validado.",
  },
  {
    id: "authorization_fallback_reads",
    status: "disabled",
    classification: "mal_justificado",
    location: "lib/auth/business-access.ts",
    summary: "El fallback admin duplicaba ownership que ya debe resolver RLS con cliente autenticado.",
  },
] as const satisfies readonly ServiceRoleUsageInventoryEntry[];

export type ServiceRoleUsageId = (typeof SERVICE_ROLE_USAGE_INVENTORY)[number]["id"];

const ACTIVE_SERVICE_ROLE_USAGE_IDS = new Set<ServiceRoleUsageId>();

export function assertServiceRoleUsageAllowed(usageId: ServiceRoleUsageId) {
  if (!ACTIVE_SERVICE_ROLE_USAGE_IDS.has(usageId)) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY no esta habilitada para "${usageId}" en este MVP. Revisa lib/supabase/service-role.ts antes de reintroducir privilegios.`,
    );
  }
}
