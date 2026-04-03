import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

import { getOperationalEnv } from "@/lib/env";

const operationalEnv = getOperationalEnv();

export interface SupabaseAuthCookieMutation {
  name: string;
  value: string;
  options: CookieOptions;
}

function createStatelessSupabaseClient(accessToken: string) {
  return createClient(operationalEnv.nextPublicSupabaseUrl, accessToken, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServerSupabaseAuthClient(
  options?: {
    onCookiesSet?: (cookiesToSet: SupabaseAuthCookieMutation[]) => void;
  },
) {
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
          options?.onCookiesSet?.(cookiesToSet);

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

export function applySupabaseAuthCookies(
  response: NextResponse,
  cookiesToSet: SupabaseAuthCookieMutation[],
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
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

export type ServerSupabaseAuthClient = Awaited<
  ReturnType<typeof createServerSupabaseAuthClient>
>;
