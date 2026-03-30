import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import {
  getBusinessAccessByOrderId,
  getBusinessAccessBySlug,
  type BusinessAccessResult,
} from "@/lib/auth/business-access";
import { buildLoginHref } from "@/lib/auth/redirect-path";
import {
  canAccessBusinessWorkspaceRole,
  isPlatformAdminRole,
  type AppRole,
} from "@/lib/auth/roles";
import { getUserProfileByUserId } from "@/lib/auth/user-profiles";
import {
  createServerSupabaseAuthClient,
  type ServerSupabaseAuthClient,
} from "@/lib/supabase/server";
import type { OrderId } from "@/types/identifiers";

export {
  buildLoginHref,
  sanitizePrivateRedirectPath,
  sanitizeRedirectPath,
} from "@/lib/auth/redirect-path";

export interface WorkspaceUser {
  userId: string;
  email: string;
  role: AppRole;
  user: User;
}

export interface BusinessContext extends BusinessAccessResult {
  user: WorkspaceUser;
}

export type AuthenticatedApiResult =
  | {
      ok: true;
      user: WorkspaceUser;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export type BusinessApiContextResult =
  | {
      ok: true;
      context: BusinessContext;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function mapWorkspaceUser(
  user: User,
  supabase: ServerSupabaseAuthClient,
): Promise<WorkspaceUser> {
  const userProfile = await getUserProfileByUserId(user.id, supabase);

  if (!userProfile) {
    throw new Error(
      `El usuario autenticado ${user.id} no tiene un perfil persistido en public.user_profiles.`,
    );
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    role: userProfile.role,
    user,
  };
}

function buildUnauthenticatedApiResponse() {
  return NextResponse.json(
    { error: "Debes iniciar sesion para usar este espacio operativo." },
    { status: 401 },
  );
}

function buildForbiddenBusinessRoleApiResponse() {
  return NextResponse.json(
    { error: "Tu rol autenticado no puede operar workspaces de negocio." },
    { status: 403 },
  );
}

function buildForbiddenBusinessApiResponse() {
  return NextResponse.json(
    { error: "No tienes acceso a este negocio." },
    { status: 403 },
  );
}

function buildForbiddenOrderApiResponse() {
  return NextResponse.json(
    { error: "No tienes acceso a este pedido." },
    { status: 403 },
  );
}

function buildForbiddenAdminApiResponse() {
  return NextResponse.json(
    { error: "No tienes acceso al panel interno de plataforma." },
    { status: 403 },
  );
}

async function getBusinessContextForUser(
  businessSlug: string,
  user: WorkspaceUser,
): Promise<BusinessContext | null> {
  if (!canAccessBusinessWorkspaceRole(user.role)) {
    return null;
  }

  const access = await getBusinessAccessBySlug(businessSlug, user.userId);

  if (!access) {
    return null;
  }

  return {
    ...access,
    user,
  };
}

export async function getCurrentUser(
  supabase?: ServerSupabaseAuthClient,
): Promise<WorkspaceUser | null> {
  const authSupabase = supabase ?? (await createServerSupabaseAuthClient());
  const {
    data: { user },
    error,
  } = await authSupabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return mapWorkspaceUser(user, authSupabase);
}

export async function requireAuthenticatedUser(
  redirectTo: string,
  supabase?: ServerSupabaseAuthClient,
) {
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect(buildLoginHref(redirectTo));
  }

  return user;
}

export async function requireBusinessOperatorUser(
  redirectTo: string,
  supabase?: ServerSupabaseAuthClient,
) {
  const user = await requireAuthenticatedUser(redirectTo, supabase);
  return canAccessBusinessWorkspaceRole(user.role) ? user : null;
}

export async function requirePlatformAdmin(
  redirectTo: string,
  supabase?: ServerSupabaseAuthClient,
) {
  const user = await requireAuthenticatedUser(redirectTo, supabase);
  return isPlatformAdminRole(user.role) ? user : null;
}

export async function requireAuthenticatedApiUser(
  supabase?: ServerSupabaseAuthClient,
): Promise<AuthenticatedApiResult> {
  const user = await getCurrentUser(supabase);

  if (!user) {
    return {
      ok: false as const,
      response: buildUnauthenticatedApiResponse(),
    };
  }

  return {
    ok: true as const,
    user,
  };
}

export async function requireBusinessOperatorApiUser(
  supabase?: ServerSupabaseAuthClient,
): Promise<AuthenticatedApiResult> {
  const authResult = await requireAuthenticatedApiUser(supabase);

  if (!authResult.ok) {
    return authResult;
  }

  if (!canAccessBusinessWorkspaceRole(authResult.user.role)) {
    return {
      ok: false as const,
      response: buildForbiddenBusinessRoleApiResponse(),
    };
  }

  return authResult;
}

export async function requirePlatformAdminApiUser(
  supabase?: ServerSupabaseAuthClient,
): Promise<AuthenticatedApiResult> {
  const authResult = await requireAuthenticatedApiUser(supabase);

  if (!authResult.ok) {
    return authResult;
  }

  if (!isPlatformAdminRole(authResult.user.role)) {
    return {
      ok: false as const,
      response: buildForbiddenAdminApiResponse(),
    };
  }

  return authResult;
}

export async function getCurrentBusinessContext(
  businessSlug: string,
): Promise<BusinessContext | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return getBusinessContextForUser(businessSlug, user);
}

export async function requireBusinessContext(
  businessSlug: string,
  redirectTo: string,
): Promise<BusinessContext | null> {
  const user = await requireBusinessOperatorUser(redirectTo);

  if (!user) {
    return null;
  }

  return getBusinessContextForUser(businessSlug, user);
}

export async function requireBusinessApiContext(
  businessSlug: string,
): Promise<BusinessApiContextResult> {
  const authResult = await requireBusinessOperatorApiUser();

  if (!authResult.ok) {
    return authResult;
  }

  const context = await getBusinessContextForUser(businessSlug, authResult.user);

  if (!context) {
    return {
      ok: false as const,
      response: buildForbiddenBusinessApiResponse(),
    };
  }

  return {
    ok: true as const,
    context,
  };
}

export async function requireOrderApiContext(
  orderId: OrderId,
): Promise<BusinessApiContextResult> {
  const authResult = await requireBusinessOperatorApiUser();

  if (!authResult.ok) {
    return authResult;
  }

  const access = await getBusinessAccessByOrderId(orderId, authResult.user.userId);

  if (!access) {
    return {
      ok: false as const,
      response: buildForbiddenOrderApiResponse(),
    };
  }

  return {
    ok: true as const,
    context: {
      ...access,
      user: authResult.user,
    },
  };
}
