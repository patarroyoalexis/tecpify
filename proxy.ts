import type { NextRequest } from "next/server";

import { enforcePrivateRouteProxyAuth } from "@/lib/auth/proxy";

export function proxy(request: NextRequest) {
  return enforcePrivateRouteProxyAuth(request);
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/pedidos/:path*", "/metricas/:path*"],
};
