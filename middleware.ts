import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  OPERATOR_SESSION_COOKIE_NAME,
  PRIVATE_WORKSPACE_PREFIXES,
} from "@/lib/auth/constants";

function isPrivateWorkspacePath(pathname: string) {
  return PRIVATE_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isPrivateWorkspacePath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(OPERATOR_SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("redirectTo", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/pedidos/:path*", "/metricas/:path*"],
};
