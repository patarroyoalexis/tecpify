import { readOrdersForBusiness } from "@/data/order-storage";

export interface CustomerProfile {
  customerName: string;
  customerPhone: string;
  address?: string;
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("57")) {
    return digits.slice(2);
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

export function isValidWhatsAppPhone(value: string) {
  return normalizeWhatsAppPhone(value).length >= 10;
}

export function findCustomerProfileByWhatsApp(
  businessId: string,
  phone: string,
): CustomerProfile | null {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone || normalizedPhone.length < 10) {
    return null;
  }

  const orders = readOrdersForBusiness(businessId) ?? [];
  const matchingOrder = orders.find(
    (order) =>
      normalizeWhatsAppPhone(order.customerPhone ?? "") === normalizedPhone,
  );

  if (!matchingOrder) {
    return null;
  }

  return {
    customerName: matchingOrder.client,
    customerPhone: matchingOrder.customerPhone ?? normalizedPhone,
    address: matchingOrder.address,
  };
}
