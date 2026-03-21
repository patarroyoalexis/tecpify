import type { BusinessRecord, CreateBusinessPayload } from "@/types/businesses";

interface CreateBusinessResponse {
  business: BusinessRecord;
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "No fue posible crear el negocio.";
  } catch {
    return "No fue posible crear el negocio.";
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
    throw new Error(await parseApiError(response));
  }

  const result = (await response.json()) as CreateBusinessResponse;
  return result.business;
}
