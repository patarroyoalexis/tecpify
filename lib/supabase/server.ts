import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isUsingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

if (!supabaseServerKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.",
  );
}

export function createServerSupabaseClient() {
  const resolvedUrl = supabaseUrl!;
  const resolvedKey = supabaseServerKey!;

  return createClient(resolvedUrl, resolvedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseServerAuthMode() {
  return {
    isUsingServiceRole,
    keySource: isUsingServiceRole
      ? "SUPABASE_SERVICE_ROLE_KEY"
      : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  };
}
