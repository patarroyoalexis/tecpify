import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";
import {
  assertServiceRoleUsageAllowed,
  type ServiceRoleUsageId,
} from "@/lib/supabase/service-role";

// Internal-only helper. No importar desde rutas, loaders ni acciones del flujo normal del MVP.
export function createInternalServiceRoleSupabaseClient(usageId: ServiceRoleUsageId) {
  assertServiceRoleUsageAllowed(usageId);

  const serverEnv = getServerEnv();

  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no esta configurada para el flujo privilegiado solicitado.",
    );
  }

  return createClient(serverEnv.nextPublicSupabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
