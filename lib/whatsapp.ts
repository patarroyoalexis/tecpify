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
