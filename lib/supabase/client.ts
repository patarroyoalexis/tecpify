import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

const publicEnv = getPublicEnv();

export const supabase = createClient(
  publicEnv.nextPublicSupabaseUrl,
  publicEnv.nextPublicSupabaseAnonKey,
);
