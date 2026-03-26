import type {
  BusinessRecord,
  CreateBusinessPayload,
  LegacyBusinessOwnershipRemediationRecord,
} from "@/types/businesses";

interface CreateBusinessResponse {
  business: BusinessRecord;
}

interface RequestLegacyBusinessOwnershipRemediationResponse {
  remediation: LegacyBusinessOwnershipRemediationRecord;
}

interface ClaimLegacyBusinessOwnershipRemediationResponse {
  business: BusinessRecord;
}

async function parseApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function createBusinessViaApi(payload: CreateBusinessPayload) {
  let response: Response;

  try {
    response = await fetch("/api/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para crear el negocio. Revisa tu conexion e intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response, "No fue posible crear el negocio."));
  }

  const result = (await response.json()) as CreateBusinessResponse;
  return result.business;
}

export async function requestLegacyBusinessOwnershipRemediationViaApi(payload: {
  businessSlug: string;
}) {
  let response: Response;

  try {
    response = await fetch("/api/businesses/legacy-remediation/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para solicitar la remediacion legacy. Revisa tu conexion e intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        "No fue posible solicitar la remediacion legacy.",
      ),
    );
  }

  const result =
    (await response.json()) as RequestLegacyBusinessOwnershipRemediationResponse;
  return result.remediation;
}

export async function claimLegacyBusinessOwnershipRemediationViaApi(payload: {
  businessSlug: string;
}) {
  let response: Response;

  try {
    response = await fetch("/api/businesses/legacy-remediation/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para reclamar el ownership legacy. Revisa tu conexion e intenta de nuevo.",
    );
  }

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        "No fue posible reclamar el ownership legacy.",
      ),
    );
  }

  const result =
    (await response.json()) as ClaimLegacyBusinessOwnershipRemediationResponse;
  return result.business;
}
