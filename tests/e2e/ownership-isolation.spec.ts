import { expect, test } from "@playwright/test";

import {
  assertOrderVisibleInWorkspace,
  createManualOrderThroughPrivateApi,
  createProductThroughPrivateApi,
  createActiveProductFromDrawer,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  createOrderFromPublicStorefront,
  getOwnedBusinessResourceIds,
  listOrdersFromPrivateApi,
  listProductsFromPrivateApi,
  loginThroughUi,
  logoutThroughUi,
  type OwnedBusinessResourceIds,
  resolveTestUsers,
  updateOrderThroughPrivateApi,
  updateProductThroughPrivateApi,
} from "./support/mvp-critical-flow";

const ownershipUsers = resolveTestUsers();

test.describe("Ownership isolation", () => {
  test("user B cannot read or operate the business created by user A", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const scenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;
    const intruderProductName = `${scenario.productName} intruso nuevo`;
    const intruderManualCustomerName = `${scenario.customerName} intruso manual`;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir el storefront publico.");
    }

    let ownedResourceIds: OwnedBusinessResourceIds | null = null;
    let ownedProductsBeforeCount = 0;
    let ownedOrdersBeforeCount = 0;

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
      ownedProductsBeforeCount = (
        await listProductsFromPrivateApi(page, scenario.businessSlug)
      ).length;
      ownedOrdersBeforeCount = (
        await listOrdersFromPrivateApi(page, scenario.businessSlug)
      ).length;
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
        const readProductsAttempt = await intruderPage.evaluate(async (businessSlug) => {
          const response = await fetch(
            `/api/products?businessSlug=${encodeURIComponent(businessSlug)}`,
          );
          return {
            status: response.status,
            payload: await response.json().catch(() => null),
          };
        }, scenario.businessSlug);
        expect(readProductsAttempt.status).toBe(403);
        expect(readProductsAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const readOrdersAttempt = await intruderPage.evaluate(async (businessSlug) => {
          const response = await fetch(
            `/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`,
          );
          return {
            status: response.status,
            payload: await response.json().catch(() => null),
          };
        }, scenario.businessSlug);
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

      await test.step("user B cannot create new products or manual orders inside user A business", async () => {
        const createProductAttempt = await createProductThroughPrivateApi(
          intruderPage,
          {
            businessSlug: scenario.businessSlug,
            name: intruderProductName,
            description: "Intento de intrusion Playwright sobre producto ajeno",
            price: 9900,
            isAvailable: true,
          },
        );
        expect(createProductAttempt.status).toBe(403);
        expect(createProductAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });

        const createManualOrderAttempt = await createManualOrderThroughPrivateApi(
          intruderPage,
          {
            businessSlug: scenario.businessSlug,
            customerName: intruderManualCustomerName,
            customerWhatsApp: scenario.customerPhone,
            deliveryType: "recogida en tienda",
            paymentMethod: "Transferencia",
            total: scenario.productPrice,
            products: [
              {
                productId: resolvedOwnedResourceIds.productId,
                name: scenario.productName,
                quantity: 1,
                unitPrice: scenario.productPrice,
              },
            ],
          },
        );
        expect(createManualOrderAttempt.status).toBe(403);
        expect(createManualOrderAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });
      });
    } finally {
      await intruderContext.close();
    }

    await test.step("user A still sees the original business intact after the blocked intruder POSTs", async () => {
      await loginThroughUi(page, ownershipUsers.owner);
      const productsAfterIntrusion = await listProductsFromPrivateApi(page, scenario.businessSlug);
      const ordersAfterIntrusion = await listOrdersFromPrivateApi(page, scenario.businessSlug);

      expect(productsAfterIntrusion).toHaveLength(ownedProductsBeforeCount);
      expect(ordersAfterIntrusion).toHaveLength(ownedOrdersBeforeCount);
      expect(
        productsAfterIntrusion.some((product) => product.name === intruderProductName),
      ).toBe(false);
      expect(
        ordersAfterIntrusion.some((order) => order.client === intruderManualCustomerName),
      ).toBe(false);
      expect(
        productsAfterIntrusion.some(
          (product) => product.productId === resolvedOwnedResourceIds.productId,
        ),
      ).toBe(true);
      expect(
        ordersAfterIntrusion.some((order) => order.orderId === resolvedOwnedResourceIds.orderId),
      ).toBe(true);
    });
  });
});
