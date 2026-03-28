import type {
  DeliveryType,
  FiadoStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/orders";

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
  "isFiado",
  "fiadoStatus",
  "fiadoObservation",
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
]);
const CASH_PAYMENT_METHODS = new Set<PaymentMethod>(["Efectivo", "Contra entrega"]);
const OPERATIONAL_ORDER_STATUSES_REQUIRING_CONFIRMED_PAYMENT = new Set<OrderStatus>([
  "confirmado",
  "en preparación",
  "listo",
  "entregado",
]);

export interface OrderStateSnapshot {
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}

export interface AuthoritativeOrderStatePatchInput {
  deliveryType?: DeliveryType;
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

export interface OrderFiadoSnapshot {
  isFiado: boolean;
  fiadoStatus: FiadoStatus | null;
  fiadoObservation: string | null;
}

export interface AuthoritativeOrderFiadoPatchInput {
  isFiado?: boolean;
  fiadoStatus?: FiadoStatus | null;
  fiadoObservation?: string | null;
}

export interface AuthoritativeOrderFiadoPatchResult {
  nextState: OrderFiadoSnapshot;
  changedFields: Array<keyof OrderFiadoSnapshot>;
}

function isPendingPaymentStatus(paymentStatus: PaymentStatus) {
  return (
    paymentStatus === "pendiente" ||
    paymentStatus === "con novedad" ||
    paymentStatus === "no verificado"
  );
}

function collectLegacyOrderProductAliasFields(
  products: unknown,
  pathPrefix = "products",
): string[] {
  if (!Array.isArray(products)) {
    return [];
  }

  return products.flatMap((product, index) => {
    if (!product || typeof product !== "object" || Array.isArray(product)) {
      return [];
    }

    return "product_id" in product ? [`${pathPrefix}[${index}].product_id`] : [];
  });
}

export function isPaymentMethodAllowedForDeliveryType(
  paymentMethod: PaymentMethod,
  deliveryType: DeliveryType,
): boolean {
  if (paymentMethod === "Contra entrega") {
    return deliveryType === "domicilio";
  }

  return true;
}

export function getOrderPaymentMethodDeliveryTypeError(
  deliveryType: DeliveryType,
  paymentMethod: PaymentMethod,
) {
  if (!isPaymentMethodAllowedForDeliveryType(paymentMethod, deliveryType)) {
    return "Contra entrega solo se permite en pedidos a domicilio.";
  }

  return null;
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

  invalidFields.push(...collectLegacyOrderProductAliasFields(payload.products));

  return {
    sanitizedPayload,
    ignoredDerivedFields,
    invalidFields,
  };
}

function normalizeFiadoObservation(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
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
  const paymentMethodDeliveryTypeError = getOrderPaymentMethodDeliveryTypeError(
    state.deliveryType,
    state.paymentMethod,
  );

  if (paymentMethodDeliveryTypeError) {
    return paymentMethodDeliveryTypeError;
  }

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

export function getOrderFiadoConsistencyError(state: OrderFiadoSnapshot) {
  if (!state.isFiado) {
    if (state.fiadoStatus !== null || state.fiadoObservation !== null) {
      return "Cuando el pedido no esta marcado como fiado, fiadoStatus y fiadoObservation deben quedar en null.";
    }

    return null;
  }

  if (state.fiadoStatus !== "pending" && state.fiadoStatus !== "paid") {
    return "Los pedidos fiados deben tener fiadoStatus en pending o paid.";
  }

  if (!normalizeFiadoObservation(state.fiadoObservation)) {
    return "La observacion de fiado es obligatoria.";
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

export function getOrderFiadoUpdateError(
  currentState: OrderFiadoSnapshot,
  patch: AuthoritativeOrderFiadoPatchInput,
  options?: { allowsFiado?: boolean },
) {
  try {
    resolveAuthoritativeOrderFiadoPatch(currentState, patch, options);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid order update payload.";
  }
}

export function resolveAuthoritativeOrderFiadoPatch(
  currentState: OrderFiadoSnapshot,
  patch: AuthoritativeOrderFiadoPatchInput,
  options?: { allowsFiado?: boolean },
): AuthoritativeOrderFiadoPatchResult {
  const nextIsFiado = patch.isFiado ?? currentState.isFiado;
  const nextFiadoStatus =
    patch.fiadoStatus !== undefined ? patch.fiadoStatus : currentState.fiadoStatus;
  const nextFiadoObservation =
    patch.fiadoObservation !== undefined
      ? normalizeFiadoObservation(patch.fiadoObservation)
      : currentState.fiadoObservation;
  const nextState: OrderFiadoSnapshot = {
    isFiado: nextIsFiado,
    fiadoStatus: nextFiadoStatus,
    fiadoObservation: nextFiadoObservation,
  };
  const isCreatingNewFiado = !currentState.isFiado && nextState.isFiado;
  const isTryingToEditFiado =
    patch.isFiado !== undefined ||
    patch.fiadoStatus !== undefined ||
    patch.fiadoObservation !== undefined;

  if (
    isTryingToEditFiado &&
    !currentState.isFiado &&
    !options?.allowsFiado &&
    nextState.isFiado
  ) {
    throw new Error(
      "Invalid order update payload. Este negocio no tiene habilitado el fiado interno.",
    );
  }

  if (currentState.isFiado && patch.isFiado === false) {
    throw new Error(
      "Invalid order update payload. Un pedido fiado no puede desmarcarse; debes marcarlo como pagado.",
    );
  }

  if (isCreatingNewFiado && nextState.fiadoStatus !== "pending") {
    throw new Error(
      "Invalid order update payload. Un fiado nuevo solo puede activarse con fiadoStatus pending.",
    );
  }

  if (currentState.isFiado && currentState.fiadoStatus === "pending") {
    const isValidPendingTransition =
      nextState.fiadoStatus === "pending" || nextState.fiadoStatus === "paid";

    if (!isValidPendingTransition) {
      throw new Error(
        "Invalid order update payload. Un fiado pendiente solo puede mantenerse pendiente o marcarse como paid.",
      );
    }
  }

  if (currentState.isFiado && currentState.fiadoStatus === "paid") {
    const onlyObservationChanged =
      nextState.isFiado === true &&
      nextState.fiadoStatus === "paid" &&
      nextState.fiadoObservation !== null;

    if (!onlyObservationChanged) {
      throw new Error(
        "Invalid order update payload. Un fiado pagado no puede volver a estado pendiente ni desactivarse.",
      );
    }
  }

  const consistencyError = getOrderFiadoConsistencyError(nextState);

  if (consistencyError) {
    throw new Error(`Invalid order update payload. ${consistencyError}`);
  }

  const changedFields = (
    [
      currentState.isFiado !== nextState.isFiado ? "isFiado" : null,
      currentState.fiadoStatus !== nextState.fiadoStatus ? "fiadoStatus" : null,
      currentState.fiadoObservation !== nextState.fiadoObservation
        ? "fiadoObservation"
        : null,
    ] as Array<keyof OrderFiadoSnapshot | null>
  ).filter((field): field is keyof OrderFiadoSnapshot => field !== null);

  return {
    nextState,
    changedFields,
  };
}

export function resolveAuthoritativeOrderStatePatch(
  currentState: OrderStateSnapshot,
  patch: AuthoritativeOrderStatePatchInput,
): AuthoritativeOrderStatePatchResult {
  const nextDeliveryType = patch.deliveryType ?? currentState.deliveryType;
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
    deliveryType: nextDeliveryType,
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
      currentState.deliveryType !== nextState.deliveryType ? "deliveryType" : null,
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
