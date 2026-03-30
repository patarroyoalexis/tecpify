import { expect, test } from "@playwright/test";

import {
  assertOrderVisibleInWorkspace,
  createActiveProductFromDrawer,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  createOrderFromPublicStorefront,
  listOrdersFromPrivateApi,
  loginThroughUi,
  resolveTestUsers,
  switchBusinessFromNavbar,
  waitForOrderInPrivateApi,
  waitForProductInPrivateApi,
} from "./support/mvp-critical-flow";

const testUsers = resolveTestUsers();

test.describe("MVP critical flow", () => {
  test("owner can create a business, publish a product, receive a public order and see it in the correct workspace", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const scenario = createCriticalFlowScenario();
    const secondBusinessScenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;
    let ownedProductId: string | null = null;
    let ownedOrderId: string | null = null;

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

    await test.step("the persisted order is linked to the correct businessSlug and productId", async () => {
      const ownedProduct = await waitForProductInPrivateApi(
        page,
        scenario.businessSlug,
        scenario.productName,
      );
      const ownedOrder = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
        customerName: scenario.customerName,
        productName: scenario.productName,
      });

      ownedProductId = ownedProduct.productId ?? null;
      ownedOrderId = ownedOrder.orderId ?? null;
      expect("productId" in ownedProduct).toBe(true);
      expect("id" in ownedProduct).toBe(false);
      expect("orderId" in ownedOrder).toBe(true);
      expect("id" in ownedOrder).toBe(false);
      expect(ownedOrder.businessSlug).toBe(scenario.businessSlug);
      expect(ownedOrder.products).toEqual([
        expect.objectContaining({
          productId: ownedProduct.productId,
          name: scenario.productName,
          quantity: 1,
        }),
      ]);
    });

    await test.step("the order does not appear in a second business of the same owner", async () => {
      if (!ownedProductId || !ownedOrderId) {
        throw new Error("No fue posible resolver el productId y orderId reales del flujo critico.");
      }

      await createBusinessFromWorkspace(page, secondBusinessScenario);

      const secondBusinessOrders = await listOrdersFromPrivateApi(
        page,
        secondBusinessScenario.businessSlug,
      );

      expect(secondBusinessOrders).toHaveLength(0);
      expect(
        secondBusinessOrders.some(
          (order) =>
            order.orderId === ownedOrderId ||
            order.client === scenario.customerName ||
            order.businessSlug === scenario.businessSlug ||
            order.products?.some((product) => product.productId === ownedProductId),
          ),
      ).toBe(false);
    });

    await test.step("the workspace navbar switches businesses and no visible link sends the owner back to a general dashboard home", async () => {
      await switchBusinessFromNavbar(page, scenario.businessSlug);

      await expect(page).toHaveURL(new RegExp(`/dashboard/${scenario.businessSlug}$`));
      await expect(page.getByTestId("workspace-current-business-name")).toContainText(
        scenario.businessName,
      );
      await expect(page.locator('a[href="/dashboard"]')).toHaveCount(0);
    });
  });
});
