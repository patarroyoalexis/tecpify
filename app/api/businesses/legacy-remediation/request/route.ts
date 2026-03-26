import { NextResponse } from "next/server";

import { requireAuthenticatedApiUser } from "@/lib/auth/server";
import { requestLegacyBusinessOwnershipRemediation } from "@/lib/data/business-ownership-remediation";

const REQUEST_REMEDIATION_ALLOWED_FIELDS = new Set(["businessSlug"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

interface RequestLegacyBusinessRemediationDependencies {
  requireAuthenticatedApiUser: typeof requireAuthenticatedApiUser;
  requestLegacyBusinessOwnershipRemediation: typeof requestLegacyBusinessOwnershipRemediation;
}

export function createLegacyBusinessRemediationRequestRouteHandlers(
  dependencies: RequestLegacyBusinessRemediationDependencies = {
    requireAuthenticatedApiUser,
    requestLegacyBusinessOwnershipRemediation,
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
          { error: "El body JSON para solicitar remediacion legacy no es valido." },
          { status: 400 },
        );
      }

      if (!isPlainObject(payload)) {
        return NextResponse.json(
          { error: "El payload para solicitar remediacion legacy debe ser un objeto JSON." },
          { status: 400 },
        );
      }

      const invalidFields = Object.keys(payload).filter(
        (field) => !REQUEST_REMEDIATION_ALLOWED_FIELDS.has(field),
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `El payload para solicitar remediacion legacy contiene campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      if (typeof payload.businessSlug !== "string" || payload.businessSlug.trim().length === 0) {
        return NextResponse.json(
          { error: "businessSlug es obligatorio para solicitar remediacion legacy." },
          { status: 400 },
        );
      }

      try {
        const remediation = await dependencies.requestLegacyBusinessOwnershipRemediation(
          payload.businessSlug,
        );

        return NextResponse.json({ remediation }, { status: 200 });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No fue posible solicitar la remediacion legacy.";
        const statusCode =
          message.includes("no existe")
            ? 404
            : message.includes("ya tiene owner")
              ? 409
              : message.includes("ya fue solicitada por otro operador")
                ? 409
                : message.includes("ya fue asignada a otro operador")
                  ? 403
                : 400;

        return NextResponse.json({ error: message }, { status: statusCode });
      }
    },
  };
}

const legacyBusinessRemediationRequestRouteHandlers =
  createLegacyBusinessRemediationRequestRouteHandlers();

export const POST = legacyBusinessRemediationRequestRouteHandlers.POST;
