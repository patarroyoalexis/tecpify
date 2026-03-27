import { expect, test } from "@playwright/test";

import {
  assertOrderVisibleInWorkspace,
  createActiveProductFromDrawer,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  createOrderFromPublicStorefront,
  ensureUserExists,
  loginThroughUi,
  resolveTestUsers,
} from "./support/mvp-critical-flow";

const testUsers = resolveTestUsers();

test.beforeAll(async ({ request }) => {
  await ensureUserExists(request, testUsers.owner);
  await ensureUserExists(request, testUsers.intruder);
});

test.describe("MVP critical flow", () => {
  test("owner can create a business, publish a product, receive a public order and see it in the correct workspace", async ({
    browser,
    page,
  }, testInfo) => {
    const scenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir el storefront publico.");
    }

    await test.step("owner login and business creation", async () => {
      await loginThroughUi(page, testUsers.owner);
      await createBusinessFromWorkspace(page, scenario);
    });

    await test.step("product activation for storefront", async () => {
      await createActiveProductFromDrawer(page, scenario);
    });

    await test.step("public storefront order creation by slug", async () => {
      const storefrontContext = await browser.newContext({ baseURL });
      const storefrontPage = await storefrontContext.newPage();

      try {
        await createOrderFromPublicStorefront(storefrontPage, scenario);
      } finally {
        await storefrontContext.close();
      }
    });

    await test.step("private workspace order visibility for the owner", async () => {
      await assertOrderVisibleInWorkspace(page, scenario);
    });
  });

  test("another authenticated user cannot access or operate a business they do not own", async ({
    browser,
    page,
  }, testInfo) => {
    const scenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir un contexto secundario.");
    }

    await test.step("owner creates an operable business", async () => {
      await loginThroughUi(page, testUsers.owner);
      await createBusinessFromWorkspace(page, scenario);
      await createActiveProductFromDrawer(page, scenario);
    });

    const intruderContext = await browser.newContext({ baseURL });
    const intruderPage = await intruderContext.newPage();

    try {
      await test.step("intruder is blocked from private dashboard and orders routes", async () => {
        await loginThroughUi(intruderPage, testUsers.intruder);

        await intruderPage.goto(`/dashboard/${scenario.businessSlug}`);
        await expect(intruderPage.getByTestId("unauthorized-business-access")).toBeVisible();

        await intruderPage.goto(`/pedidos/${scenario.businessSlug}`);
        await expect(intruderPage.getByTestId("unauthorized-business-access")).toBeVisible();
      });

      await test.step("intruder cannot mutate or read the business through private APIs", async () => {
        const createProductAttempt = await intruderPage.evaluate(async (businessSlug) => {
          const response = await fetch("/api/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              businessSlug,
              name: "Producto intruso",
              price: 9999,
              isAvailable: true,
              isFeatured: false,
            }),
          });
          const payload = await response.json().catch(() => null);

          return {
            status: response.status,
            payload,
          };
        }, scenario.businessSlug);

        expect(createProductAttempt.status).toBe(403);
        expect(createProductAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const readOrdersAttempt = await intruderPage.evaluate(async (businessSlug) => {
          const response = await fetch(
            `/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`,
            {
              method: "GET",
            },
          );
          const payload = await response.json().catch(() => null);

          return {
            status: response.status,
            payload,
          };
        }, scenario.businessSlug);

        expect(readOrdersAttempt.status).toBe(403);
        expect(readOrdersAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });
      });
    } finally {
      await intruderContext.close();
    }
  });
});
