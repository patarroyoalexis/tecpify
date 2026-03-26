import { createClient } from "@supabase/supabase-js";

import { getOperationalEnv } from "@/lib/env";
import {
  assertServiceRoleUsageAllowed,
  type ServiceRoleUsageId,
} from "@/lib/supabase/service-role";

function readPrivilegedServiceRoleKey() {
  const normalizedValue = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!normalizedValue) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no esta configurada para el flujo privilegiado solicitado.",
    );
  }

  return normalizedValue;
}

// Internal-only helper. No importar desde rutas, loaders ni acciones del flujo normal del MVP.
export function createInternalServiceRoleSupabaseClient(usageId: ServiceRoleUsageId) {
  assertServiceRoleUsageAllowed(usageId);
  const operationalEnv = getOperationalEnv();
  const privilegedServiceRoleKey = readPrivilegedServiceRoleKey();

  return createClient(operationalEnv.nextPublicSupabaseUrl, privilegedServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
