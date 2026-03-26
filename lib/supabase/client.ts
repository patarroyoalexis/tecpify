import { createClient } from "@supabase/supabase-js";
import { getOperationalEnv } from "@/lib/env";

const operationalEnv = getOperationalEnv();

export const supabase = createClient(
  operationalEnv.nextPublicSupabaseUrl,
  operationalEnv.nextPublicSupabaseAnonKey,
);
