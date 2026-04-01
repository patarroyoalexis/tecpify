import {
  expect,
  type Page,
} from "@playwright/test";

import { getPlaywrightAuthFixtures } from "../../../lib/env";
import type {
  DeliveryType,
  OrderHistoryEvent,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../../types/orders";

export interface TestUserCredentials {
  email: string;
  password: string;
}

export interface TestUsers {
  admin: TestUserCredentials;
  owner: TestUserCredentials;
  intruder: TestUserCredentials;
}

export interface CriticalFlowScenario {
  businessName: string;
  businessSlug: string;
  productName: string;
  productPrice: number;
  customerName: string;
  customerPhone: string;
}

interface SessionApiAttempt<TPayload = unknown> {
  status: number;
  payload: TPayload | string | null;
}

export interface PrivateProductApiRecord {
  productId?: string;
  name?: string;
  price?: number;
}

interface PrivateProductsApiPayload {
  products?: PrivateProductApiRecord[];
  error?: string;
}

export interface PrivateOrderApiRecord {
  orderId?: string;
  businessSlug?: string;
  client?: string;
  customerPhone?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryType?: DeliveryType;
  paymentMethod?: PaymentMethod;
  isReviewed?: boolean;
  history?: OrderHistoryEvent[];
  products?: Array<{
    productId?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
}

interface PrivateOrdersApiPayload {
  orders?: PrivateOrderApiRecord[];
  error?: string;
}

interface PublicOrdersApiCreatePayload {
  order?: PrivateOrderApiRecord;
  orderCode?: string | null;
  error?: string;
}

interface PrivateProductsApiCreatePayload {
  product?: PrivateProductApiRecord;
  error?: string;
}

interface PrivateWorkspaceOrdersApiCreatePayload {
  order?: PrivateOrderApiRecord;
  orderCode?: string | null;
  error?: string;
}

export interface PrivateBusinessApiRecord {
  businessId?: string;
  businessSlug?: string;
  name?: string;
  transferInstructions?: string | null;
  acceptsCash?: boolean;
  acceptsTransfer?: boolean;
  acceptsCard?: boolean;
  allowsFiado?: boolean;
}

interface PrivateBusinessApiPayload {
  business?: PrivateBusinessApiRecord;
  error?: string;
}

export interface StorefrontOrderCreationOptions {
  customerName?: string;
  customerPhone?: string;
  deliveryType?: DeliveryType;
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface OrderLookupOptions {
  orderId?: string;
  customerName?: string;
  productName?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  timeoutMs?: number;
}

export interface OwnedBusinessResourceIds {
  productId: string;
  orderId: string;
}

function isPrivateProductsApiPayload(
  payload: SessionApiAttempt<PrivateProductsApiPayload>["payload"],
): payload is PrivateProductsApiPayload {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload);
}

function isPrivateOrdersApiPayload(
  payload: SessionApiAttempt<PrivateOrdersApiPayload>["payload"],
): payload is PrivateOrdersApiPayload {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload);
}

function buildGeneratedSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildOrderLookupDescription(options: OrderLookupOptions) {
  return [
    options.orderId ? `orderId=${options.orderId}` : null,
    options.customerName ? `customerName=${options.customerName}` : null,
    options.productName ? `productName=${options.productName}` : null,
    options.status ? `status=${options.status}` : null,
    options.paymentStatus ? `paymentStatus=${options.paymentStatus}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function orderMatchesLookup(
  order: PrivateOrderApiRecord | undefined,
  options: OrderLookupOptions,
) {
  if (!order) {
    return false;
  }

  if (options.orderId && order.orderId !== options.orderId) {
    return false;
  }

  if (options.customerName && order.client !== options.customerName) {
    return false;
  }

  if (
    options.productName &&
    (!Array.isArray(order.products) ||
      !order.products.some((product) => product?.name === options.productName))
  ) {
    return false;
  }

  if (options.status && order.status !== options.status) {
    return false;
  }

  if (options.paymentStatus && order.paymentStatus !== options.paymentStatus) {
    return false;
  }

  return Boolean(order.orderId);
}

export function resolveTestUsers(): TestUsers {
  const fixtures = getPlaywrightAuthFixtures();

  return {
    admin: {
      email: fixtures.admin.email,
      password: fixtures.admin.password,
    },
    owner: {
      email: fixtures.owner.email,
      password: fixtures.owner.password,
    },
    intruder: {
      email: fixtures.intruder.email,
      password: fixtures.intruder.password,
    },
  };
}

export function createCriticalFlowScenario(): CriticalFlowScenario {
  const suffix = buildGeneratedSuffix();

  return {
    businessName: `Negocio E2E ${suffix}`,
    businessSlug: `negocio-e2e-${suffix}`.toLowerCase(),
    productName: `Producto E2E ${suffix}`,
    productPrice: 14900,
    customerName: `Cliente E2E ${suffix}`,
    customerPhone: "3001234567",
  };
}

export async function loginThroughUi(page: Page, credentials: TestUserCredentials) {
  await page.goto("/login?redirectTo=/dashboard");
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.getByTestId("login-email-input").fill(credentials.email);
  await page.getByTestId("login-password-input").fill(credentials.password);
  await page.getByTestId("login-submit-button").click();

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toMatch(/^\/dashboard(?:\/[^/]+)?$/);
  await expect
    .poll(() => new URL(page.url()).pathname)
    .not.toBe("/dashboard");
}

export async function logoutThroughUi(page: Page) {
  await expect(page.getByTestId("logout-button")).toBeVisible();
  await page.getByTestId("logout-button").click();
  await page.waitForURL((url) => url.pathname === "/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
}

export async function goToCreateBusinessFlow(page: Page) {
  await page.goto("/ajustes/crear-negocio");
  await expect(page).toHaveURL(/\/ajustes\/crear-negocio$/);
  await expect(page.getByTestId("create-business-panel")).toBeVisible();
}

export async function createBusinessFromWorkspace(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  await goToCreateBusinessFlow(page);
  await page.getByTestId("business-name-input").fill(scenario.businessName);
  await page.getByTestId("business-slug-input").fill(scenario.businessSlug);
  await page.getByTestId("create-business-submit-button").click();

  await page.waitForURL(
    new RegExp(`/dashboard/${scenario.businessSlug}(\\?onboarding=create-product)?$`),
  );
  await expect(page.getByTestId("products-management-drawer")).toBeVisible();
  await expect(page.getByTestId("product-form")).toBeVisible();
}

export async function switchBusinessFromNavbar(
  page: Page,
  nextBusinessSlug: string,
) {
  await page.getByTestId("workspace-settings-trigger").click();
  await expect(page.getByTestId("workspace-business-switcher")).toBeVisible();
  await page.getByTestId(`workspace-business-option-${nextBusinessSlug}`).click();
  await page.waitForURL(new RegExp(`/dashboard/${nextBusinessSlug}$`));
}

export async function createActiveProductFromDrawer(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  await page.getByTestId("product-form-name-input").fill(scenario.productName);
  await page.getByTestId("product-form-price-input").fill(`${scenario.productPrice}`);

  const availableCheckbox = page.getByTestId("product-form-available-checkbox");
  if (!(await availableCheckbox.isChecked())) {
    await availableCheckbox.check();
  }

  await page.getByTestId("product-form-submit-button").click();
  await waitForProductInPrivateApi(page, scenario.businessSlug, scenario.productName);
}

export async function openPublicStorefront(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  const storefrontUrl = `/pedido/${scenario.businessSlug}`;
  const storefrontUrlPattern = new RegExp(`/pedido/${scenario.businessSlug}$`);
  const deadline = Date.now() + 15_000;
  let lastDiagnostic = "Storefront publico aun no disponible.";

  while (Date.now() < deadline) {
    await page.goto(storefrontUrl);
    await expect(page).toHaveURL(storefrontUrlPattern);

    if (await page.getByTestId("storefront-order-wizard").count()) {
      await expect(page.getByTestId("storefront-order-wizard")).toBeVisible();
      return;
    }

    if (await page.getByTestId("storefront-business-not-found").count()) {
      lastDiagnostic = "El storefront devolvio 'Negocio no encontrado'.";
    } else if (await page.getByTestId("storefront-business-without-products").count()) {
      lastDiagnostic =
        "El storefront devolvio 'Catalogo no disponible' aun cuando el producto ya fue activado en el workspace.";
    } else {
      lastDiagnostic = (
        await page.locator("body").innerText().catch(() => "Sin contenido legible en body.")
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `El storefront publico no quedo listo para ${scenario.businessSlug}. ${lastDiagnostic}`,
  );
}

export async function createOrderFromPublicStorefront(
  page: Page,
  scenario: CriticalFlowScenario,
  options?: StorefrontOrderCreationOptions,
) {
  const deliveryType = options?.deliveryType ?? "recogida en tienda";
  const paymentMethod = options?.paymentMethod ?? "Transferencia";
  const customerPhone = options?.customerPhone ?? scenario.customerPhone;
  const customerName = options?.customerName ?? scenario.customerName;

  await openPublicStorefront(page, scenario);
  const inlineProducts = page.getByTestId("storefront-inline-products");
  await expect(inlineProducts.getByText(scenario.productName)).toBeVisible();

  await inlineProducts.getByRole("button", { name: `Sumar ${scenario.productName}` }).click();
  await page.getByTestId("storefront-customer-phone-input").fill(customerPhone);
  await page.getByTestId("storefront-customer-name-input").fill(customerName);
  await page.getByTestId("storefront-delivery-type-select").selectOption(deliveryType);

  if (deliveryType === "domicilio") {
    await page
      .getByTestId("storefront-delivery-address-input")
      .fill(options?.deliveryAddress ?? "Calle 10 # 20-30");
  }

  await page.getByTestId("storefront-payment-method-select").selectOption(paymentMethod);

  if (options?.notes) {
    await page.getByTestId("storefront-order-notes-input").fill(options.notes);
  }

  await page.getByTestId("storefront-privacy-checkbox").check();
  await page.getByTestId("storefront-submit-order-button").click();

  await expect(page.getByTestId("storefront-order-confirmation")).toBeVisible();
  await expect(page.getByTestId("storefront-order-confirmation")).toContainText(
    customerName,
  );
}

export async function assertOrderVisibleInWorkspace(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  await page.goto(`/pedidos/${scenario.businessSlug}`);
  await expect(page).toHaveURL(new RegExp(`/pedidos/${scenario.businessSlug}$`));
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByText(scenario.customerName)).toBeVisible();
  await expect(page.getByText(scenario.productName)).toBeVisible();
}

async function requestJsonInBrowserSession<TPayload>(
  page: Page,
  request: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
  },
): Promise<SessionApiAttempt<TPayload>> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(path, {
        method,
        headers:
          body === undefined
            ? undefined
            : {
                "Content-Type": "application/json",
              },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const rawPayload = await response.text().catch(() => "");

      try {
        return {
          status: response.status,
          payload: rawPayload ? JSON.parse(rawPayload) : null,
        };
      } catch {
        return {
          status: response.status,
          payload: rawPayload || null,
        };
      }
    },
    request,
  );
}

export async function getProductsFromPrivateApi(page: Page, businessSlug: string) {
  return requestJsonInBrowserSession<PrivateProductsApiPayload>(page, {
    method: "GET",
    path: `/api/products?businessSlug=${encodeURIComponent(businessSlug)}`,
  });
}

export async function getOrdersFromPrivateApi(page: Page, businessSlug: string) {
  return requestJsonInBrowserSession<PrivateOrdersApiPayload>(page, {
    method: "GET",
    path: `/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`,
  });
}

export async function listProductsFromPrivateApi(page: Page, businessSlug: string) {
  const productsAttempt = await getProductsFromPrivateApi(page, businessSlug);
  expect(productsAttempt.status).toBe(200);

  if (!isPrivateProductsApiPayload(productsAttempt.payload)) {
    throw new Error(
      `La respuesta de /api/products para ${businessSlug} no devolvio un payload valido.`,
    );
  }

  return productsAttempt.payload.products ?? [];
}

export async function listOrdersFromPrivateApi(page: Page, businessSlug: string) {
  const ordersAttempt = await getOrdersFromPrivateApi(page, businessSlug);
  expect(ordersAttempt.status).toBe(200);

  if (!isPrivateOrdersApiPayload(ordersAttempt.payload)) {
    throw new Error(
      `La respuesta de /api/orders para ${businessSlug} no devolvio un payload valido.`,
    );
  }

  return ordersAttempt.payload.orders ?? [];
}

export async function createOrderThroughPublicApi(
  page: Page,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession<PublicOrdersApiCreatePayload>(page, {
    method: "POST",
    path: "/api/orders",
    body: payload,
  });
}

export async function createBusinessThroughPrivateApi(
  page: Page,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession<PrivateBusinessApiPayload>(page, {
    method: "POST",
    path: "/api/businesses",
    body: payload,
  });
}

export async function createProductThroughPrivateApi(
  page: Page,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession<PrivateProductsApiCreatePayload>(page, {
    method: "POST",
    path: "/api/products",
    body: payload,
  });
}

export async function createManualOrderThroughPrivateApi(
  page: Page,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession<PrivateWorkspaceOrdersApiCreatePayload>(page, {
    method: "POST",
    path: "/api/orders/private",
    body: payload,
  });
}

export async function updateProductThroughPrivateApi(
  page: Page,
  productId: string,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession(page, {
    method: "PATCH",
    path: `/api/products/${productId}`,
    body: payload,
  });
}

export async function updateOrderThroughPrivateApi(
  page: Page,
  orderId: string,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession(page, {
    method: "PATCH",
    path: `/api/orders/${orderId}`,
    body: payload,
  });
}

export async function updateBusinessSettingsThroughPrivateApi(
  page: Page,
  payload: Record<string, unknown>,
) {
  return requestJsonInBrowserSession<PrivateBusinessApiPayload>(page, {
    method: "PATCH",
    path: "/api/businesses",
    body: payload,
  });
}

export async function waitForProductInPrivateApi(
  page: Page,
  businessSlug: string,
  productName: string,
  options?: { timeoutMs?: number },
) {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;
  let lastPayloadSummary = "<sin payload>";

  while (Date.now() < deadline) {
    const productsAttempt = await getProductsFromPrivateApi(page, businessSlug);

    if (productsAttempt.status === 200) {
      const productsPayload = isPrivateProductsApiPayload(productsAttempt.payload)
        ? productsAttempt.payload
        : null;
      const matchedProduct = Array.isArray(productsPayload?.products)
        ? productsPayload.products.find(
            (product: PrivateProductApiRecord | undefined) =>
              product?.name === productName &&
              typeof product.productId === "string" &&
              typeof product.price === "number",
          )
        : null;

      if (matchedProduct?.productId && typeof matchedProduct.price === "number") {
        return matchedProduct;
      }
    }

    lastPayloadSummary =
      productsAttempt.payload === null
        ? "<sin payload>"
        : typeof productsAttempt.payload === "string"
          ? productsAttempt.payload
          : JSON.stringify(productsAttempt.payload);
    await page.waitForTimeout(750);
  }

  throw new Error(
    `No encontramos el producto ${productName} en /api/products para ${businessSlug}. payload=${lastPayloadSummary}`,
  );
}

export async function waitForOrderInPrivateApi(
  page: Page,
  businessSlug: string,
  lookup: OrderLookupOptions,
) {
  const timeoutMs = lookup.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;
  const lookupDescription = buildOrderLookupDescription(lookup) || "sin criterios";
  let lastPayloadSummary = "<sin payload>";

  while (Date.now() < deadline) {
    const ordersAttempt = await getOrdersFromPrivateApi(page, businessSlug);

    if (ordersAttempt.status === 200) {
      const ordersPayload = isPrivateOrdersApiPayload(ordersAttempt.payload)
        ? ordersAttempt.payload
        : null;
      const matchedOrder = Array.isArray(ordersPayload?.orders)
        ? ordersPayload.orders.find((order) => orderMatchesLookup(order, lookup))
        : null;

      if (matchedOrder?.orderId) {
        return matchedOrder;
      }
    }

    lastPayloadSummary =
      ordersAttempt.payload === null
        ? "<sin payload>"
        : typeof ordersAttempt.payload === "string"
          ? ordersAttempt.payload
          : JSON.stringify(ordersAttempt.payload);
    await page.waitForTimeout(750);
  }

  throw new Error(
    `No encontramos el pedido buscado en /api/orders para ${businessSlug}. ${lookupDescription}. payload=${lastPayloadSummary}`,
  );
}

export async function getOwnedBusinessResourceIds(
  page: Page,
  scenario: CriticalFlowScenario,
): Promise<OwnedBusinessResourceIds> {
  const ownedProduct = await waitForProductInPrivateApi(
    page,
    scenario.businessSlug,
    scenario.productName,
  );
  const ownedOrder = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
    customerName: scenario.customerName,
    productName: scenario.productName,
  });

  if (!ownedProduct.productId || !ownedOrder.orderId) {
    throw new Error(
      `No fue posible resolver los IDs reales de producto y pedido para ${scenario.businessSlug}.`,
    );
  }

  return {
    productId: ownedProduct.productId,
    orderId: ownedOrder.orderId,
  };
}
