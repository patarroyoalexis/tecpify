import { NextResponse } from "next/server";

import {
  persistActiveWorkspaceBusinessCookie,
} from "@/lib/auth/private-workspace";
import { requireBusinessApiContext } from "@/lib/auth/server";
import { requireBusinessSlug } from "@/lib/businesses/slug";

interface ActiveBusinessPayload {
  businessSlug: string;
}

function isValidActiveBusinessPayload(payload: unknown): payload is ActiveBusinessPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<ActiveBusinessPayload>;
  return typeof candidate.businessSlug === "string";
}

export function createActiveBusinessRouteHandlers(
  dependencies: {
    requireBusinessApiContext?: typeof requireBusinessApiContext;
    persistActiveWorkspaceBusinessCookie?: typeof persistActiveWorkspaceBusinessCookie;
  } = {},
) {
  return {
    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "El body JSON para negocio activo no es valido." },
          { status: 400 },
        );
      }

      if (!isValidActiveBusinessPayload(payload)) {
        return NextResponse.json(
          { error: "businessSlug es obligatorio y debe ser valido." },
          { status: 400 },
        );
      }

      let normalizedBusinessSlug = "";

      try {
        normalizedBusinessSlug = requireBusinessSlug(payload.businessSlug);
      } catch {
        return NextResponse.json(
          { error: "businessSlug es obligatorio y debe ser valido." },
          { status: 400 },
        );
      }

      const businessContextResult = await (
        dependencies.requireBusinessApiContext ?? requireBusinessApiContext
      )(normalizedBusinessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      const response = NextResponse.json(
        {
          ok: true,
          activeBusiness: {
            businessId: businessContextResult.context.businessId,
            businessSlug: businessContextResult.context.businessSlug,
            businessName: businessContextResult.context.businessName,
          },
        },
        { status: 200 },
      );

      (dependencies.persistActiveWorkspaceBusinessCookie ??
        persistActiveWorkspaceBusinessCookie)(
        response,
        businessContextResult.context.businessSlug,
      );

      return response;
    },
  };
}

const activeBusinessRouteHandlers = createActiveBusinessRouteHandlers();

export const POST = activeBusinessRouteHandlers.POST;
