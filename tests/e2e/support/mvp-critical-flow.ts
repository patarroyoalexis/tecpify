import { expect, type Page } from "@playwright/test";

import { getPlaywrightEnv } from "../../../lib/env";
import { createConfirmedE2eUser } from "./supabase-admin-bootstrap";

type UserSource = "env" | "generated";

export interface TestUserCredentials {
  email: string;
  password: string;
  source: UserSource;
}

export interface TestUsers {
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

function buildGeneratedSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readConfiguredUser(role: "OWNER" | "INTRUDER"): TestUserCredentials | null {
  const playwrightEnv = getPlaywrightEnv();
  const email =
    role === "OWNER" ? playwrightEnv.ownerEmail : playwrightEnv.intruderEmail;
  const password =
    role === "OWNER" ? playwrightEnv.ownerPassword : playwrightEnv.intruderPassword;

  if (!email && !password) {
    return null;
  }

  if (!email || !password) {
    throw new Error(
      `Configura ambas variables PLAYWRIGHT_${role}_EMAIL y PLAYWRIGHT_${role}_PASSWORD, o deja ambas vacias.`,
    );
  }

  return {
    email,
    password,
    source: "env",
  };
}

function createGeneratedUser(role: "owner" | "intruder"): TestUserCredentials {
  const suffix = buildGeneratedSuffix();

  return {
    email: `playwright-${role}-${suffix}@example.com`,
    password: `Tecpify!${suffix}`,
    source: "generated",
  };
}

export function resolveTestUsers(): TestUsers {
  return {
    owner: readConfiguredUser("OWNER") ?? createGeneratedUser("owner"),
    intruder: readConfiguredUser("INTRUDER") ?? createGeneratedUser("intruder"),
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

export async function ensureUserExists(
  credentials: TestUserCredentials,
) {
  if (credentials.source !== "generated") {
    return;
  }

  await createConfirmedE2eUser(credentials);
}

export async function loginThroughUi(page: Page, credentials: TestUserCredentials) {
  await page.goto("/login?redirectTo=/dashboard");
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.getByTestId("login-email-input").fill(credentials.email);
  await page.getByTestId("login-password-input").fill(credentials.password);
  await page.getByTestId("login-submit-button").click();

  await page.waitForURL((url) => url.pathname === "/dashboard");
  await expect(page.getByTestId("create-business-panel")).toBeVisible();
}

export async function createBusinessFromWorkspace(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  await page.getByTestId("business-name-input").fill(scenario.businessName);
  await page.getByTestId("business-slug-input").fill(scenario.businessSlug);
  await page.getByTestId("create-business-submit-button").click();

  await page.waitForURL(
    new RegExp(`/dashboard/${scenario.businessSlug}(\\?onboarding=create-product)?$`),
  );
  await expect(page.getByTestId("products-management-drawer")).toBeVisible();
  await expect(page.getByTestId("product-form")).toBeVisible();
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

  await expect(page.getByTestId("products-drawer-ready-state")).toBeVisible();
  await expect(page.getByTestId("products-management-drawer")).toContainText(
    `/pedido/${scenario.businessSlug}`,
  );
}

export async function createOrderFromPublicStorefront(
  page: Page,
  scenario: CriticalFlowScenario,
) {
  await page.goto(`/pedido/${scenario.businessSlug}`);
  await expect(page.getByTestId("storefront-order-wizard")).toBeVisible();
  await expect(page.getByText(scenario.productName)).toBeVisible();

  await page.getByRole("button", { name: `Sumar ${scenario.productName}` }).click();
  await page.getByTestId("storefront-customer-phone-input").fill(scenario.customerPhone);
  await page.getByTestId("storefront-customer-name-input").fill(scenario.customerName);
  await page.getByTestId("storefront-delivery-type-select").selectOption("recogida en tienda");
  await page.getByTestId("storefront-payment-method-select").selectOption("Nequi");
  await page.getByTestId("storefront-privacy-checkbox").check();
  await page.getByTestId("storefront-submit-order-button").click();

  await expect(page.getByTestId("storefront-order-confirmation")).toBeVisible();
  await expect(page.getByTestId("storefront-order-confirmation")).toContainText(
    scenario.customerName,
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
