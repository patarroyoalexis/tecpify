type Brand<TValue, TName extends string> = TValue & {
  readonly __brand: TName;
};

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BusinessId = Brand<string, "BusinessId">;
export type BusinessSlug = Brand<string, "BusinessSlug">;
export type OrderId = Brand<string, "OrderId">;
export type OrderCode = Brand<string, "OrderCode">;
export type ProductId = Brand<string, "ProductId">;

function normalizeIdentifierCandidate(value: string) {
  return value.trim();
}

export function isUuidLike(value: string) {
  return UUID_LIKE_PATTERN.test(normalizeIdentifierCandidate(value));
}

export function parseBusinessId(value: string): BusinessId | null {
  const normalizedValue = normalizeIdentifierCandidate(value);
  return isUuidLike(normalizedValue) ? (normalizedValue as BusinessId) : null;
}

export function requireBusinessId(value: string, label = "businessId"): BusinessId {
  const businessId = parseBusinessId(value);

  if (!businessId) {
    throw new Error(`El ${label} debe ser un UUID valido.`);
  }

  return businessId;
}

export function parseOrderId(value: string): OrderId | null {
  const normalizedValue = normalizeIdentifierCandidate(value);
  return isUuidLike(normalizedValue) ? (normalizedValue as OrderId) : null;
}

export function requireOrderId(value: string, label = "orderId"): OrderId {
  const orderId = parseOrderId(value);

  if (!orderId) {
    throw new Error(`El ${label} debe ser un UUID valido.`);
  }

  return orderId;
}

export function parseProductId(value: string): ProductId | null {
  const normalizedValue = normalizeIdentifierCandidate(value);
  return isUuidLike(normalizedValue) ? (normalizedValue as ProductId) : null;
}

export function requireProductId(value: string, label = "productId"): ProductId {
  const productId = parseProductId(value);

  if (!productId) {
    throw new Error(`El ${label} debe ser un UUID valido.`);
  }

  return productId;
}

export function parseOrderCode(value: string): OrderCode | null {
  const normalizedValue = normalizeIdentifierCandidate(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue as OrderCode;
}

export function requireOrderCode(value: string, label = "orderCode"): OrderCode {
  const orderCode = parseOrderCode(value);

  if (!orderCode) {
    throw new Error(`El ${label} debe ser un texto no vacio.`);
  }

  return orderCode;
}
