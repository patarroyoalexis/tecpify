import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getOperationalEnv } from "@/lib/env";

const operationalEnv = getOperationalEnv();

function createStatelessSupabaseClient(accessToken: string) {
  return createClient(operationalEnv.nextPublicSupabaseUrl, accessToken, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServerSupabaseAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    operationalEnv.nextPublicSupabaseUrl,
    operationalEnv.nextPublicSupabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can read cookies but may not always be allowed to mutate them.
          }
        },
      },
    },
  );
}

export function createServerSupabasePublicClient() {
  return createStatelessSupabaseClient(operationalEnv.nextPublicSupabaseAnonKey);
}

export function getSupabaseServerAuthMode(mode: "auth" | "public" = "auth") {
  return {
    mode,
    keySource: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    isUsingServiceRole: false,
  };
}
