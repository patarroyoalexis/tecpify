import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { OPERATOR_SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(OPERATOR_SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/pedidos/:path*", "/metricas/:path*"],
};
