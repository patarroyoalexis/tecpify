import type {
  BusinessPaymentSettings,
  BusinessRecord,
} from "@/types/businesses";
import type { PaymentMethod } from "@/types/orders";

export const DEFAULT_BUSINESS_PAYMENT_SETTINGS: BusinessPaymentSettings = {
  acceptsCash: true,
  acceptsTransfer: true,
  acceptsCard: true,
  allowsFiado: false,
};

export function readBusinessPaymentSettings(
  business: Pick<
    BusinessRecord,
    "acceptsCash" | "acceptsTransfer" | "acceptsCard" | "allowsFiado"
  >,
): BusinessPaymentSettings {
  return {
    acceptsCash: business.acceptsCash,
    acceptsTransfer: business.acceptsTransfer,
    acceptsCard: business.acceptsCard,
    allowsFiado: business.allowsFiado,
  };
}

export function getPublicPaymentMethodsForBusiness(
  settings: BusinessPaymentSettings,
): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  if (settings.acceptsCash) {
    methods.push("Efectivo", "Contra entrega");
  }

  if (settings.acceptsTransfer) {
    methods.push("Transferencia");
  }

  if (settings.acceptsCard) {
    methods.push("Tarjeta");
  }

  return methods;
}

export function isPublicPaymentMethodEnabledForBusiness(
  settings: BusinessPaymentSettings,
  paymentMethod: PaymentMethod,
) {
  return getPublicPaymentMethodsForBusiness(settings).includes(paymentMethod);
}

export function getBusinessPaymentMethodAvailabilityError(
  settings: BusinessPaymentSettings,
  paymentMethod: PaymentMethod,
) {
  if (isPublicPaymentMethodEnabledForBusiness(settings, paymentMethod)) {
    return null;
  }

  return `Este negocio no tiene habilitado el metodo de pago "${paymentMethod}".`;
}
