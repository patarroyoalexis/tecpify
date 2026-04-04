import type { LocalDeliveryQuote } from "@/types/local-delivery";

interface LocalDeliveryQuoteResponse {
  quote: LocalDeliveryQuote;
}

export async function fetchStorefrontLocalDeliveryQuote(payload: {
  businessSlug: string;
  neighborhoodId: string;
}) {
  let response: Response;

  try {
    response = await fetch("/api/local-delivery/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "No pudimos conectar con el servidor para cotizar el domicilio local.",
    );
  }

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? (responseBody as { error?: string }).error
        : "No fue posible cotizar el domicilio local.";
    throw new Error(errorMessage ?? "No fue posible cotizar el domicilio local.");
  }

  return (responseBody as LocalDeliveryQuoteResponse).quote;
}
