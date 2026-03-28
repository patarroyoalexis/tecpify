import type {
  BusinessRecord,
  CreateBusinessPayload,
  UpdateBusinessSettingsPayload,
} from "@/types/businesses";

interface BusinessResponse {
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

  const result = (await response.json()) as BusinessResponse;
  return result.business;
}

export async function updateBusinessSettingsViaApi(
  payload: UpdateBusinessSettingsPayload,
) {
  let response: Response;

  try {
    response = await fetch("/api/businesses", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para guardar la configuracion del negocio.",
    );
  }

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        "No fue posible guardar la configuracion del negocio.",
      ),
    );
  }

  const result = (await response.json()) as BusinessResponse;
  return result.business;
}
