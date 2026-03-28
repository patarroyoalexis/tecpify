import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { buildLoginHref } from "@/lib/auth/redirect-path";
import { getOperationalEnv } from "@/lib/env";

const operationalEnv = getOperationalEnv();

export const PRIVATE_ROUTE_PROXY_MATCHER = [
  "/dashboard/:path*",
  "/pedidos/:path*",
  "/metricas/:path*",
] as const;

export const PRIVATE_ROUTE_PROXY_CONFIG = {
  matcher: [...PRIVATE_ROUTE_PROXY_MATCHER],
};

interface ProxyAuthUser {
  id: string;
}

interface ProxySupabaseAuthClient {
  auth: {
    getUser(): Promise<{
      data: {
        user: ProxyAuthUser | null;
      };
      error: unknown;
    }>;
  };
}

interface ProxyDependencies {
  createSupabaseClient?: (
    request: NextRequest,
    response: NextResponse,
  ) => ProxySupabaseAuthClient;
}

function buildRequestedPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function createProxySupabaseAuthClient(
  request: NextRequest,
  response: NextResponse,
): ProxySupabaseAuthClient {
  return createServerClient(
    operationalEnv.nextPublicSupabaseUrl,
    operationalEnv.nextPublicSupabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}

export async function enforcePrivateRouteProxyAuth(
  request: NextRequest,
  dependencies: ProxyDependencies = {},
) {
  const response = NextResponse.next();
  const supabase =
    dependencies.createSupabaseClient?.(request, response) ??
    createProxySupabaseAuthClient(request, response);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL(buildLoginHref(buildRequestedPath(request)), request.url));
  }

  return response;
}
