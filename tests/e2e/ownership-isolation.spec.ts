import { expect, test } from "@playwright/test";

import {
  assertOrderVisibleInWorkspace,
  createActiveProductFromDrawer,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  createOrderFromPublicStorefront,
  ensureUserExists,
  getOrdersFromPrivateApi,
  getOwnedBusinessResourceIds,
  getProductsFromPrivateApi,
  loginThroughUi,
  logoutThroughUi,
  type OwnedBusinessResourceIds,
  resolveTestUsers,
  updateOrderThroughPrivateApi,
  updateProductThroughPrivateApi,
} from "./support/mvp-critical-flow";

const ownershipUsers = resolveTestUsers();

test.beforeAll(async ({ request }) => {
  await ensureUserExists(request, ownershipUsers.owner);
  await ensureUserExists(request, ownershipUsers.intruder);
});

test.describe("Ownership isolation", () => {
  test("user B cannot read or operate the business created by user A", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const scenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir el storefront publico.");
    }

    let ownedResourceIds: OwnedBusinessResourceIds | null = null;

    await test.step("user A creates and operates a real owned business", async () => {
      await loginThroughUi(page, ownershipUsers.owner);
      await createBusinessFromWorkspace(page, scenario);
      await createActiveProductFromDrawer(page, scenario);

      const storefrontContext = await browser.newContext({ baseURL });
      const storefrontPage = await storefrontContext.newPage();

      try {
        await createOrderFromPublicStorefront(storefrontPage, scenario);
      } finally {
        await storefrontContext.close();
      }

      await assertOrderVisibleInWorkspace(page, scenario);
      ownedResourceIds = await getOwnedBusinessResourceIds(page, scenario);
    });

    if (!ownedResourceIds) {
      throw new Error("No fue posible resolver los IDs reales del producto y pedido del negocio owner.");
    }

    const resolvedOwnedResourceIds = ownedResourceIds as OwnedBusinessResourceIds;

    await test.step("user A logs out before switching accounts", async () => {
      await logoutThroughUi(page);
    });

    const intruderContext = await browser.newContext({ baseURL });
    const intruderPage = await intruderContext.newPage();

    try {
      await test.step("user B logs in with a different account", async () => {
        await loginThroughUi(intruderPage, ownershipUsers.intruder);
      });

      await test.step("user B is blocked from the private workspace of user A", async () => {
        for (const privateRoute of [
          `/dashboard/${scenario.businessSlug}`,
          `/pedidos/${scenario.businessSlug}`,
          `/metricas/${scenario.businessSlug}`,
        ]) {
          await intruderPage.goto(privateRoute);
          await expect(intruderPage.getByTestId("unauthorized-business-access")).toBeVisible();
        }
      });

      await test.step("user B cannot read or mutate products and orders owned by user A", async () => {
        const readProductsAttempt = await getProductsFromPrivateApi(
          intruderPage,
          scenario.businessSlug,
        );
        expect(readProductsAttempt.status).toBe(403);
        expect(readProductsAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const readOrdersAttempt = await getOrdersFromPrivateApi(
          intruderPage,
          scenario.businessSlug,
        );
        expect(readOrdersAttempt.status).toBe(403);
        expect(readOrdersAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const updateProductAttempt = await updateProductThroughPrivateApi(
          intruderPage,
          resolvedOwnedResourceIds.productId,
          {
            businessSlug: scenario.businessSlug,
            name: `${scenario.productName} intruso`,
          },
        );
        expect(updateProductAttempt.status).toBe(403);
        expect(updateProductAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const updateOrderAttempt = await updateOrderThroughPrivateApi(
          intruderPage,
          resolvedOwnedResourceIds.orderId,
          {
            notes: "Intento de edicion ajena desde Playwright",
          },
        );
        expect(updateOrderAttempt.status).toBe(403);
        expect(updateOrderAttempt.payload).toMatchObject({
          error: "No tienes acceso a este pedido.",
        });
      });
    } finally {
      await intruderContext.close();
    }
  });
});
