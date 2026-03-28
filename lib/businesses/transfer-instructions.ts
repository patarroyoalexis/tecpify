export const DEFAULT_TRANSFER_INSTRUCTIONS =
  "Hola, te compartimos nuestros datos de transferencia. Cuando realices el pago, por favor envianos el comprobante por este medio.";

export function normalizeTransferInstructions(
  value: string | null | undefined,
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveTransferInstructions(
  value: string | null | undefined,
) {
  return normalizeTransferInstructions(value) ?? DEFAULT_TRANSFER_INSTRUCTIONS;
}
