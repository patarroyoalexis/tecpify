import { resolveTransferInstructions } from "@/lib/businesses/transfer-instructions";

export function normalizePhoneForWhatsApp(
  phone: string,
  defaultCountryCode = "57",
) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.startsWith(defaultCountryCode) && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }

  if (digits.length > 10 && digits.length < 12) {
    return `${defaultCountryCode}${digits.slice(-10)}`;
  }

  return digits;
}

export function isValidWhatsAppPhone(
  phone: string,
  defaultCountryCode = "57",
) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone, defaultCountryCode);
  return normalizedPhone.length >= 12;
}

export function buildWhatsAppUrl(
  phone: string,
  message: string,
  defaultCountryCode = "57",
) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone, defaultCountryCode);

  if (!normalizedPhone || normalizedPhone.length < 12) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function normalizeMessageSegment(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function formatOrderTotalForWhatsApp(total: number | null | undefined) {
  if (!Number.isFinite(total) || typeof total !== "number" || total <= 0) {
    return "";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(total);
}

export function buildPaymentProofWhatsAppMessage(options: {
  businessName: string | null | undefined;
  customerName?: string | null;
  orderCode?: string | null;
  total?: number | null;
  transferInstructions?: string | null;
}) {
  const customerName = normalizeMessageSegment(options.customerName);
  const businessName = normalizeMessageSegment(options.businessName);
  const orderCode = normalizeMessageSegment(options.orderCode);
  const formattedTotal = formatOrderTotalForWhatsApp(options.total);
  const resolvedTransferInstructions = resolveTransferInstructions(
    options.transferInstructions,
  );
  const lines = [
    customerName ? `Hola ${customerName}.` : "Hola.",
    businessName ? `Te escribimos de ${businessName}.` : "",
    orderCode ? `Codigo del pedido: ${orderCode}.` : "",
    formattedTotal ? `Total del pedido: ${formattedTotal}.` : "",
    "Instrucciones de transferencia:",
    resolvedTransferInstructions,
    "Cuando realices el pago, por favor envianos el comprobante por este medio.",
  ].filter((line) => line.length > 0);

  return lines.join("\n\n");
}
