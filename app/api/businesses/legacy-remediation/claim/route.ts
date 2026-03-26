import { NextResponse } from "next/server";

import { requireAuthenticatedApiUser } from "@/lib/auth/server";
import { claimLegacyBusinessOwnershipRemediation } from "@/lib/data/business-ownership-remediation";

const CLAIM_REMEDIATION_ALLOWED_FIELDS = new Set(["businessSlug"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

interface ClaimLegacyBusinessRemediationDependencies {
  requireAuthenticatedApiUser: typeof requireAuthenticatedApiUser;
  claimLegacyBusinessOwnershipRemediation: typeof claimLegacyBusinessOwnershipRemediation;
}

export function createLegacyBusinessRemediationClaimRouteHandlers(
  dependencies: ClaimLegacyBusinessRemediationDependencies = {
    requireAuthenticatedApiUser,
    claimLegacyBusinessOwnershipRemediation,
  },
) {
  return {
    async POST(request: Request) {
      const authResult = await dependencies.requireAuthenticatedApiUser();

      if (!authResult.ok) {
        return authResult.response;
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "El body JSON para reclamar ownership legacy no es valido." },
          { status: 400 },
        );
      }

      if (!isPlainObject(payload)) {
        return NextResponse.json(
          { error: "El payload para reclamar ownership legacy debe ser un objeto JSON." },
          { status: 400 },
        );
      }

      const invalidFields = Object.keys(payload).filter(
        (field) => !CLAIM_REMEDIATION_ALLOWED_FIELDS.has(field),
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `El payload para reclamar ownership legacy contiene campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      if (typeof payload.businessSlug !== "string" || payload.businessSlug.trim().length === 0) {
        return NextResponse.json(
          { error: "businessSlug es obligatorio para reclamar ownership legacy." },
          { status: 400 },
        );
      }

      try {
        const business = await dependencies.claimLegacyBusinessOwnershipRemediation(
          payload.businessSlug,
        );

        return NextResponse.json({ business }, { status: 200 });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible reclamar el ownership legacy.";
        const statusCode =
          message.includes("no existe")
            ? 404
            : message.includes("asignada a otro operador")
              ? 403
              : message.includes("claim")
                ? 409
                : message.includes("ya tiene owner")
                  ? 409
                  : 400;

        return NextResponse.json({ error: message }, { status: statusCode });
      }
    },
  };
}

const legacyBusinessRemediationClaimRouteHandlers =
  createLegacyBusinessRemediationClaimRouteHandlers();

export const POST = legacyBusinessRemediationClaimRouteHandlers.POST;
