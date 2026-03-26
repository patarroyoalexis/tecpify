import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/orders";

export const ORDER_CREATE_CLIENT_EDITABLE_FIELDS = [
  "businessSlug",
  "customerName",
  "customerWhatsApp",
  "deliveryType",
  "deliveryAddress",
  "paymentMethod",
  "products",
  "total",
  "notes",
] as const;

export const ORDER_CREATE_SERVER_DERIVED_FIELDS = [
  "status",
  "paymentStatus",
  "payment_status",
  "history",
  "isReviewed",
  "is_reviewed",
  "dateLabel",
  "date_label",
  "orderCode",
  "order_code",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "id",
] as const;

export const ORDER_UPDATE_CLIENT_EDITABLE_FIELDS = [
  "status",
  "paymentStatus",
  "customerName",
  "customerWhatsApp",
  "deliveryType",
  "deliveryAddress",
  "paymentMethod",
  "products",
  "notes",
  "total",
  "isReviewed",
  "eventIntent",
] as const;

const ORDER_CREATE_CLIENT_EDITABLE_FIELD_SET = new Set<string>(
  ORDER_CREATE_CLIENT_EDITABLE_FIELDS,
);
const ORDER_CREATE_SERVER_DERIVED_FIELD_SET = new Set<string>(
  ORDER_CREATE_SERVER_DERIVED_FIELDS,
);

const DIGITAL_PAYMENT_METHODS = new Set<PaymentMethod>([
  "Transferencia",
  "Tarjeta",
  "Nequi",
]);
const CASH_PAYMENT_METHODS = new Set<PaymentMethod>(["Efectivo", "Contra entrega"]);
const OPERATIONAL_ORDER_STATUSES_REQUIRING_CONFIRMED_PAYMENT = new Set<OrderStatus>([
  "confirmado",
  "en preparación",
  "listo",
  "entregado",
]);

export interface OrderStateSnapshot {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface AuthoritativeOrderStatePatchInput {
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  payment_status?: PaymentStatus;
  status?: OrderStatus;
}

export interface SanitizedClientCreateOrderPayloadResult {
  sanitizedPayload: Record<string, unknown>;
  ignoredDerivedFields: string[];
  invalidFields: string[];
}

export interface AuthoritativeOrderStatePatchResult {
  nextState: OrderStateSnapshot;
  changedFields: Array<keyof OrderStateSnapshot>;
  derivedFields: Array<"status" | "paymentStatus">;
}

export interface OrderStateTransitionRuleResult {
  allowed: boolean;
  reason?: string;
}

function isPendingPaymentStatus(paymentStatus: PaymentStatus) {
  return (
    paymentStatus === "pendiente" ||
    paymentStatus === "con novedad" ||
    paymentStatus === "no verificado"
  );
}

export function isDigitalPaymentMethod(method: PaymentMethod): boolean {
  return DIGITAL_PAYMENT_METHODS.has(method);
}

export function isCashPaymentMethod(method: PaymentMethod): boolean {
  return CASH_PAYMENT_METHODS.has(method);
}

export function isPaymentConfirmed(paymentStatus: PaymentStatus) {
  return paymentStatus === "verificado";
}

export function sanitizeClientCreateOrderPayload(
  payload: Record<string, unknown>,
): SanitizedClientCreateOrderPayloadResult {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([field]) =>
      ORDER_CREATE_CLIENT_EDITABLE_FIELD_SET.has(field),
    ),
  );
  const ignoredDerivedFields: string[] = [];
  const invalidFields: string[] = [];

  for (const field of Object.keys(payload)) {
    if (ORDER_CREATE_CLIENT_EDITABLE_FIELD_SET.has(field)) {
      continue;
    }

    if (ORDER_CREATE_SERVER_DERIVED_FIELD_SET.has(field)) {
      ignoredDerivedFields.push(field);
      continue;
    }

    invalidFields.push(field);
  }

  return {
    sanitizedPayload,
    ignoredDerivedFields,
    invalidFields,
  };
}

export function deriveInitialOrderStateFromPaymentMethod(
  paymentMethod: PaymentMethod,
): Pick<OrderStateSnapshot, "paymentStatus" | "status"> {
  if (isDigitalPaymentMethod(paymentMethod)) {
    return {
      paymentStatus: "pendiente",
      status: "pendiente de pago",
    };
  }

  return {
    paymentStatus: "verificado",
    status: "confirmado",
  };
}

export function getOrderStateConsistencyError(state: OrderStateSnapshot) {
  if (isCashPaymentMethod(state.paymentMethod)) {
    if (!isPaymentConfirmed(state.paymentStatus)) {
      return "Los pagos en efectivo o contra entrega solo pueden persistirse como verificados.";
    }

    if (state.status === "pendiente de pago" || state.status === "pago por verificar") {
      return "Los pedidos con pago en efectivo o contra entrega no pueden quedar en estados de validacion de pago.";
    }

    return null;
  }

  if (state.status === "pago por verificar" && !isPaymentConfirmed(state.paymentStatus)) {
    return "Solo un pago verificado puede quedar en pago por verificar.";
  }

  if (
    OPERATIONAL_ORDER_STATUSES_REQUIRING_CONFIRMED_PAYMENT.has(state.status) &&
    !isPaymentConfirmed(state.paymentStatus)
  ) {
    return "No puedes avanzar el pedido mientras el pago no este verificado.";
  }

  if (state.status === "pendiente de pago" && isPaymentConfirmed(state.paymentStatus)) {
    return "Un pago verificado no puede quedar en pendiente de pago.";
  }

  return null;
}

function getSequentialOrderStatusTransitionRule(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): OrderStateTransitionRuleResult {
  const orderStatusSequence: OrderStatus[] = [
    "pendiente de pago",
    "pago por verificar",
    "confirmado",
    "en preparación",
    "listo",
    "entregado",
  ];
  const isFinalCurrentStatus = currentStatus === "entregado" || currentStatus === "cancelado";

  if (nextStatus === currentStatus) {
    return { allowed: true };
  }

  if (isFinalCurrentStatus) {
    return {
      allowed: false,
      reason: "Este pedido ya termino su flujo y no puede seguir avanzando desde aqui.",
    };
  }

  if (nextStatus === "cancelado") {
    return { allowed: true };
  }

  const currentIndex = orderStatusSequence.indexOf(currentStatus);
  const nextIndex = orderStatusSequence.indexOf(nextStatus);

  if (nextIndex === currentIndex + 1) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Solo puedes mover el pedido al siguiente paso permitido del flujo.",
  };
}

function isCashConfirmationPromotion(
  currentState: OrderStateSnapshot,
  nextState: OrderStateSnapshot,
) {
  return (
    currentState.status === "pendiente de pago" &&
    nextState.status === "confirmado" &&
    isCashPaymentMethod(nextState.paymentMethod) &&
    isPaymentConfirmed(nextState.paymentStatus)
  );
}

function isPaymentVerificationRollback(
  currentState: OrderStateSnapshot,
  nextState: OrderStateSnapshot,
) {
  return (
    currentState.status === "pago por verificar" &&
    nextState.status === "pendiente de pago" &&
    isPendingPaymentStatus(nextState.paymentStatus)
  );
}

function getOrderStatusTransitionRuleForStatePatch(
  currentState: OrderStateSnapshot,
  nextState: OrderStateSnapshot,
): OrderStateTransitionRuleResult {
  if (isCashConfirmationPromotion(currentState, nextState)) {
    return { allowed: true };
  }

  if (isPaymentVerificationRollback(currentState, nextState)) {
    return { allowed: true };
  }

  return getSequentialOrderStatusTransitionRule(currentState.status, nextState.status);
}

function readRequestedPaymentStatus(
  patch: AuthoritativeOrderStatePatchInput,
): PaymentStatus | undefined {
  return patch.paymentStatus ?? patch.payment_status;
}

function resolveNextPaymentStatus(
  currentState: OrderStateSnapshot,
  patch: AuthoritativeOrderStatePatchInput,
  nextPaymentMethod: PaymentMethod,
) {
  const requestedPaymentStatus = readRequestedPaymentStatus(patch);

  if (isCashPaymentMethod(nextPaymentMethod)) {
    if (
      requestedPaymentStatus !== undefined &&
      requestedPaymentStatus !== "verificado"
    ) {
      throw new Error(
        "Invalid order update payload. Los pagos en efectivo o contra entrega solo pueden persistirse como verificados.",
      );
    }

    return "verificado" as PaymentStatus;
  }

  return requestedPaymentStatus ?? currentState.paymentStatus;
}

function resolveNextStatus(
  currentState: OrderStateSnapshot,
  patch: AuthoritativeOrderStatePatchInput,
  nextPaymentMethod: PaymentMethod,
  nextPaymentStatus: PaymentStatus,
) {
  if (patch.status !== undefined) {
    return {
      status: patch.status,
      derivedFields: [] as Array<"status" | "paymentStatus">,
    };
  }

  if (currentState.status === "pendiente de pago" && isPaymentConfirmed(nextPaymentStatus)) {
    return {
      status: isCashPaymentMethod(nextPaymentMethod)
        ? ("confirmado" as OrderStatus)
        : ("pago por verificar" as OrderStatus),
      derivedFields: ["status"] as Array<"status" | "paymentStatus">,
    };
  }

  if (
    currentState.status === "pago por verificar" &&
    !isPaymentConfirmed(nextPaymentStatus)
  ) {
    return {
      status: "pendiente de pago" as OrderStatus,
      derivedFields: ["status"] as Array<"status" | "paymentStatus">,
    };
  }

  return {
    status: currentState.status,
    derivedFields: [] as Array<"status" | "paymentStatus">,
  };
}

export function getOrderStateUpdateError(
  currentState: OrderStateSnapshot,
  patch: AuthoritativeOrderStatePatchInput,
) {
  try {
    resolveAuthoritativeOrderStatePatch(currentState, patch);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid order update payload.";
  }
}

export function resolveAuthoritativeOrderStatePatch(
  currentState: OrderStateSnapshot,
  patch: AuthoritativeOrderStatePatchInput,
): AuthoritativeOrderStatePatchResult {
  const nextPaymentMethod = patch.paymentMethod ?? currentState.paymentMethod;
  const nextPaymentStatus = resolveNextPaymentStatus(
    currentState,
    patch,
    nextPaymentMethod,
  );
  const resolvedStatus = resolveNextStatus(
    currentState,
    patch,
    nextPaymentMethod,
    nextPaymentStatus,
  );
  const nextState: OrderStateSnapshot = {
    paymentMethod: nextPaymentMethod,
    paymentStatus: nextPaymentStatus,
    status: resolvedStatus.status,
  };
  const consistencyError = getOrderStateConsistencyError(nextState);

  if (consistencyError) {
    throw new Error(`Invalid order update payload. ${consistencyError}`);
  }

  const transitionRule = getOrderStatusTransitionRuleForStatePatch(currentState, nextState);

  if (!transitionRule.allowed) {
    throw new Error(
      `Invalid order update payload. ${transitionRule.reason ?? "La transicion de estado no esta permitida."}`,
    );
  }

  const changedFields = (
    [
      currentState.status !== nextState.status ? "status" : null,
      currentState.paymentStatus !== nextState.paymentStatus ? "paymentStatus" : null,
      currentState.paymentMethod !== nextState.paymentMethod ? "paymentMethod" : null,
    ] as Array<keyof OrderStateSnapshot | null>
  ).filter((field): field is keyof OrderStateSnapshot => field !== null);

  const derivedFields = [...resolvedStatus.derivedFields];

  if (
    currentState.paymentStatus !== nextState.paymentStatus &&
    readRequestedPaymentStatus(patch) === undefined
  ) {
    derivedFields.push("paymentStatus");
  }

  return {
    nextState,
    changedFields,
    derivedFields,
  };
}
