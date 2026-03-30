import type { ServerSupabaseAuthClient } from "@/lib/supabase/server";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

interface UserProfileRow {
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  userId: string;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
}

function mapUserProfileRow(row: UserProfileRow): UserProfile {
  if (!isAppRole(row.role)) {
    throw new Error(`user_profiles.role contiene un valor invalido: "${row.role}".`);
  }

  return {
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserProfileByUserId(
  userId: string,
  supabase?: ServerSupabaseAuthClient,
): Promise<UserProfile | null> {
  const authSupabase = supabase ?? (await createServerSupabaseAuthClient());
  const { data, error } = await authSupabase
    .from("user_profiles")
    .select("user_id, role, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle<UserProfileRow>();

  if (error) {
    throw new Error(`No fue posible resolver el perfil del usuario autenticado: ${error.message}`);
  }

  return data ? mapUserProfileRow(data) : null;
}
