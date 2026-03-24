import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

const serverEnv = getServerEnv();

function createStatelessSupabaseClient(accessToken: string) {
  return createClient(serverEnv.nextPublicSupabaseUrl, accessToken, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServerSupabaseAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    serverEnv.nextPublicSupabaseUrl,
    serverEnv.nextPublicSupabaseAnonKey,
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
  return createStatelessSupabaseClient(serverEnv.nextPublicSupabaseAnonKey);
}

export function createServerSupabaseAdminClient() {
  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY es obligatoria para este flujo administrativo.",
    );
  }

  return createStatelessSupabaseClient(serverEnv.supabaseServiceRoleKey);
}

export function getSupabaseServerAuthMode(mode: "auth" | "public" | "admin" = "auth") {
  return {
    mode,
    keySource:
      mode === "admin"
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    isUsingServiceRole: mode === "admin",
  };
}
