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
  createServerSupabaseAuthClient,
  type ServerSupabaseAuthClient,
} from "@/lib/supabase/server";
import type { OrderId } from "@/types/identifiers";

export { buildLoginHref, sanitizeRedirectPath } from "@/lib/auth/redirect-path";

export interface WorkspaceUser {
  userId: string;
  email: string;
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

function mapWorkspaceUser(user: User): WorkspaceUser {
  return {
    userId: user.id,
    email: user.email ?? "",
    user,
  };
}

function buildUnauthenticatedApiResponse() {
  return NextResponse.json(
    { error: "Debes iniciar sesion para usar este espacio operativo." },
    { status: 401 },
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

async function getBusinessContextForUser(
  businessSlug: string,
  user: WorkspaceUser,
): Promise<BusinessContext | null> {
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

  return mapWorkspaceUser(user);
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
  const user = await requireAuthenticatedUser(redirectTo);
  return getBusinessContextForUser(businessSlug, user);
}

export async function requireBusinessApiContext(
  businessSlug: string,
): Promise<BusinessApiContextResult> {
  const authResult = await requireAuthenticatedApiUser();

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
  const authResult = await requireAuthenticatedApiUser();

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
