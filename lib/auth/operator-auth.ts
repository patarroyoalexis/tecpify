import type { User } from "@supabase/supabase-js";

import { createOperatorSession, writeOperatorSession } from "@/lib/auth/session";
import { createServerSupabaseIdentityClient } from "@/lib/supabase/server";

export interface OperatorIdentityResult {
  user: User;
  hasSupabaseSession: boolean;
}

export async function authenticateOperatorCredentials(email: string, password: string) {
  const supabase = createServerSupabaseIdentityClient();
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

export async function registerOperatorCredentials(email: string, password: string) {
  const supabase = createServerSupabaseIdentityClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
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

export async function issueOperatorSessionForUser(user: User, fallbackEmail: string) {
  await writeOperatorSession(createOperatorSession(user.email ?? fallbackEmail, user.id));
}
