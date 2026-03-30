import { expect, test, type Page } from "@playwright/test";

import {
  createBusinessThroughPrivateApi,
  createCriticalFlowScenario,
  createManualOrderThroughPrivateApi,
  createProductThroughPrivateApi,
  resolveTestUsers,
  waitForProductInPrivateApi,
} from "./support/mvp-critical-flow";

const adminUsers = resolveTestUsers();

async function loginWithRedirect(
  page: Page,
  credentials: { email: string; password: string },
  redirectTo: string,
  expectedPathname: string,
) {
  await page.goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.getByTestId("login-email-input").fill(credentials.email);
  await page.getByTestId("login-password-input").fill(credentials.password);
  await page.getByTestId("login-submit-button").click();

  await page.waitForURL((url) => url.pathname === expectedPathname);
}

async function expectApiStatus(
  attempt: { status: number; payload: unknown },
  expectedStatus: number,
  label: string,
) {
  expect(
    attempt.status,
    `${label} devolvio ${attempt.status} con payload=${JSON.stringify(attempt.payload)}`,
  ).toBe(expectedStatus);
}

test.describe("Platform admin panel", () => {
  test("platform_admin entra a /admin y business_owner queda bloqueado server-side", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const scenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para probar /admin.");
    }

    await test.step("business owner crea datos reales persistidos para la plataforma", async () => {
      await loginWithRedirect(page, adminUsers.owner, "/dashboard/crear-negocio", "/dashboard/crear-negocio");

      const businessAttempt = await createBusinessThroughPrivateApi(page, {
        name: scenario.businessName,
        businessSlug: scenario.businessSlug,
      });
      await expectApiStatus(businessAttempt, 201, `Crear negocio ${scenario.businessSlug}`);

      const productAttempt = await createProductThroughPrivateApi(page, {
        businessSlug: scenario.businessSlug,
        name: scenario.productName,
        description: `Producto real para admin ${scenario.productName}`,
        price: scenario.productPrice,
        isAvailable: true,
      });
      await expectApiStatus(productAttempt, 201, `Crear producto ${scenario.productName}`);

      const product = await waitForProductInPrivateApi(page, scenario.businessSlug, scenario.productName);

      if (!product.productId) {
        throw new Error(`No fue posible resolver el productId real para ${scenario.productName}.`);
      }

      const manualOrderAttempt = await createManualOrderThroughPrivateApi(page, {
        businessSlug: scenario.businessSlug,
        customerName: scenario.customerName,
        customerWhatsApp: scenario.customerPhone,
        deliveryType: "recogida en tienda",
        paymentMethod: "Efectivo",
        total: scenario.productPrice,
        products: [
          {
            productId: product.productId,
            name: scenario.productName,
            quantity: 1,
            unitPrice: scenario.productPrice,
          },
        ],
      });
      await expectApiStatus(
        manualOrderAttempt,
        201,
        `Crear pedido manual para ${scenario.businessSlug}`,
      );
    });

    await test.step("platform admin autenticado puede abrir el panel /admin", async () => {
      const adminContext = await browser.newContext({ baseURL });
      const adminPage = await adminContext.newPage();

      try {
        await loginWithRedirect(adminPage, adminUsers.admin, "/admin", "/admin");
        await expect(adminPage.getByTestId("admin-platform-dashboard")).toBeVisible();
        await expect(adminPage.getByTestId("admin-kpi-total_businesses")).toBeVisible();
        await expect(adminPage.getByTestId("admin-table-recent-businesses")).toContainText(
          scenario.businessSlug,
        );
        await expect(adminPage.getByTestId("workspace-admin-link")).toBeVisible();
      } finally {
        await adminContext.close();
      }
    });

    await test.step("business owner autenticado no puede entrar manualmente a /admin", async () => {
      const ownerContext = await browser.newContext({ baseURL });
      const ownerPage = await ownerContext.newPage();

      try {
        await loginWithRedirect(ownerPage, adminUsers.owner, "/dashboard/crear-negocio", "/dashboard/crear-negocio");
        await ownerPage.goto("/admin");
        await expect(ownerPage.getByTestId("unauthorized-admin-access")).toBeVisible();
      } finally {
        await ownerContext.close();
      }
    });

    await test.step("una sesion ausente rebota a /login con redirectTo=/admin", async () => {
      const anonymousContext = await browser.newContext({ baseURL });
      const anonymousPage = await anonymousContext.newPage();

      try {
        await anonymousPage.goto("/admin");
        await expect(anonymousPage).toHaveURL(/\/login\?redirectTo=%2Fadmin$/);
        await expect(anonymousPage.getByTestId("login-form")).toBeVisible();
      } finally {
        await anonymousContext.close();
      }
    });
  });
});
