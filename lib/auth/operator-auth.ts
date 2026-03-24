import type { User } from "@supabase/supabase-js";

import { getAuthCallbackUrl } from "@/lib/site-url";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";

export interface OperatorIdentityResult {
  user: User;
  hasSupabaseSession: boolean;
}

export async function authenticateOperatorCredentials(email: string, password: string) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error("Credenciales invalidas, cuenta no confirmada o usuario sin acceso.");
  }

  return {
    user: data.user,
    hasSupabaseSession: Boolean(data.session),
  } satisfies OperatorIdentityResult;
}

export async function registerOperatorCredentials(
  email: string,
  password: string,
  options?: { redirectTo?: string | null | undefined },
) {
  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthCallbackUrl({ next: options?.redirectTo }),
    },
  });

  if (error) {
    throw new Error(error.message || "No fue posible completar el registro.");
  }

  if (!data.user) {
    throw new Error("No fue posible completar el registro.");
  }

  return {
    user: data.user,
    hasSupabaseSession: Boolean(data.session),
  } satisfies OperatorIdentityResult;
}

export async function signOutAuthenticatedOperator() {
  const supabase = await createServerSupabaseAuthClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message || "No fue posible cerrar la sesion.");
  }
}
