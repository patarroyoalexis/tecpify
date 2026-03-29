import { expect, test } from "@playwright/test";

import {
  createActiveProductFromDrawer,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  createOrderFromPublicStorefront,
  createOrderThroughPublicApi,
  loginThroughUi,
  openPublicStorefront,
  resolveTestUsers,
  waitForOrderInPrivateApi,
  waitForProductInPrivateApi,
  type PrivateOrderApiRecord,
} from "./support/mvp-critical-flow";

const domainUsers = resolveTestUsers();

function readHistoryTitles(order: PrivateOrderApiRecord) {
  return (order.history ?? []).map((event) => event.title);
}

async function readPaymentMethodOptionValues(
  page: Parameters<typeof openPublicStorefront>[0],
) {
  return page
    .getByTestId("storefront-payment-method-select")
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
}

test.describe("Order domain rules", () => {
  test("digital public orders derive their initial state server-side and keep append-only history after a workspace mutation", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const scenario = createCriticalFlowScenario();
    const forgedCustomerName = `${scenario.customerName} derivado`;
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir el storefront publico.");
    }

    await test.step("owner prepares a real business with an active product", async () => {
      await loginThroughUi(page, domainUsers.owner);
      await createBusinessFromWorkspace(page, scenario);
      await createActiveProductFromDrawer(page, scenario);
    });

    const ownedProduct = await test.step("owner can resolve the real product created for this business", async () =>
      waitForProductInPrivateApi(page, scenario.businessSlug, scenario.productName),
    );

    const storefrontContext = await browser.newContext({ baseURL });
    const storefrontPage = await storefrontContext.newPage();

    try {
      await test.step("a customer creates a digital-payment order from the public storefront", async () => {
        await createOrderFromPublicStorefront(storefrontPage, scenario, {
          deliveryType: "recogida en tienda",
          paymentMethod: "Transferencia",
        });
      });

      const initialOrder = await test.step("the owner sees the initial server-derived state in the workspace and private API", async () => {
        const order = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
          customerName: scenario.customerName,
          productName: scenario.productName,
        });

        expect(order.products?.some((product) => product.productId === ownedProduct.productId)).toBe(
          true,
        );
        expect(order.paymentMethod).toBe("Transferencia");
        expect(order.deliveryType).toBe("recogida en tienda");
        expect(order.paymentStatus).toBe("pendiente");
        expect(order.status).toBe("nuevo");
        expect(order.isReviewed).toBe(false);
        expect(readHistoryTitles(order)).toEqual([
          "Pedido creado desde formulario publico",
          "Pedido registrado",
        ]);

        await page.goto(`/pedidos/${scenario.businessSlug}`);
        await expect(page).toHaveURL(new RegExp(`/pedidos/${scenario.businessSlug}$`));
        await expect(page.getByTestId(`order-card-${order.orderId}`)).toBeVisible();
        await expect(page.getByTestId(`order-card-status-${order.orderId}`)).toContainText(
          "Nuevo",
        );
        await expect(
          page.getByTestId(`order-card-financial-condition-${order.orderId}`),
        ).toContainText(
          "Pendiente",
        );

        return order;
      });

      await test.step("the public API ignores forged derived fields instead of trusting the client", async () => {
        const forgedAttempt = await createOrderThroughPublicApi(storefrontPage, {
          businessSlug: scenario.businessSlug,
          customerName: forgedCustomerName,
          customerWhatsApp: scenario.customerPhone,
          deliveryType: "recogida en tienda",
          paymentMethod: "Transferencia",
          total: ownedProduct.price,
          products: [
            {
              productId: ownedProduct.productId,
              name: scenario.productName,
              quantity: 1,
              unitPrice: ownedProduct.price,
            },
          ],
          status: "confirmado",
          paymentStatus: "verificado",
          history: [
            {
              id: "forged-event",
              title: "Historial falso",
              description: "El cliente intento inyectar history.",
              occurredAt: new Date().toISOString(),
            },
          ],
          isReviewed: true,
        });

        expect(forgedAttempt.status).toBe(201);

        const forgedOrder = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
          customerName: forgedCustomerName,
          productName: scenario.productName,
        });

        expect(forgedOrder.paymentStatus).toBe("pendiente");
        expect(forgedOrder.status).toBe("nuevo");
        expect(forgedOrder.isReviewed).toBe(false);
        expect(readHistoryTitles(forgedOrder)).toEqual([
          "Pedido creado desde formulario publico",
          "Pedido registrado",
        ]);
        expect(readHistoryTitles(forgedOrder)).not.toContain("Historial falso");
      });

      await test.step("a valid workspace action appends new history events without replacing the original snapshot", async () => {
        const initialHistoryIds = (initialOrder.history ?? []).map((event) => event.id);

        await page.getByTestId(`order-card-primary-action-${initialOrder.orderId}`).click();
        await expect(page.getByTestId("order-payment-review-modal")).toBeVisible();
        await page
          .getByTestId("order-payment-review-panel")
          .getByRole("button", { name: /marcar verificado/i })
          .click();
        const updatedOrder = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
          orderId: initialOrder.orderId,
          status: "nuevo",
          paymentStatus: "verificado",
        });

        await expect(page.getByTestId(`order-card-status-${initialOrder.orderId}`)).toContainText(
          "Nuevo",
        );
        await expect(
          page.getByTestId(`order-card-financial-condition-${initialOrder.orderId}`),
        ).toContainText("Verificado");
        const updatedHistory = updatedOrder.history ?? [];

        expect(updatedOrder.paymentStatus).toBe("verificado");
        expect(updatedOrder.status).toBe("nuevo");
        expect(updatedOrder.isReviewed).toBe(true);
        expect(updatedHistory.length).toBeGreaterThanOrEqual(initialHistoryIds.length + 1);
        expect(readHistoryTitles(updatedOrder)).toEqual(
          expect.arrayContaining([
            "Estado del pago actualizado",
            "Pedido creado desde formulario publico",
            "Pedido registrado",
          ]),
        );
        expect(updatedHistory.slice(-initialHistoryIds.length).map((event) => event.id)).toEqual(
          initialHistoryIds,
        );

        await page.getByRole("button", { name: /^cerrar$/i }).click();
        await expect(page.getByTestId("order-payment-review-modal")).toBeHidden();

        const orderCard = page.getByTestId(`order-card-${initialOrder.orderId}`);
        await orderCard.getByRole("button", { name: /ver detalle/i }).click();
        await expect(page.getByTestId("order-detail-drawer")).toBeVisible();
        await expect(page.getByTestId("order-history-section")).toBeVisible();
        await expect(page.getByTestId("order-history-event")).toHaveCount(updatedHistory.length);
        await expect(page.getByTestId("order-history-section")).toContainText(
          "Estado del pago actualizado",
        );
      });
    } finally {
      await storefrontContext.close();
    }
  });

  test("contra entrega stays blocked for pickup and valid domicilio orders keep the new operational state", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const scenario = createCriticalFlowScenario();
    const invalidCustomerName = `${scenario.customerName} invalido`;
    const validCustomerName = `${scenario.customerName} domicilio`;
    const baseURL = testInfo.project.use.baseURL;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir el storefront publico.");
    }

    await test.step("owner prepares a second real business with an active product", async () => {
      await loginThroughUi(page, domainUsers.owner);
      await createBusinessFromWorkspace(page, scenario);
      await createActiveProductFromDrawer(page, scenario);
    });

    const ownedProduct = await waitForProductInPrivateApi(
      page,
      scenario.businessSlug,
      scenario.productName,
    );
    const storefrontContext = await browser.newContext({ baseURL });
    const storefrontPage = await storefrontContext.newPage();

    try {
      await test.step("the storefront blocks contra entrega while the order is configured for pickup", async () => {
        await openPublicStorefront(storefrontPage, scenario);
        await storefrontPage
          .getByTestId("storefront-delivery-type-select")
          .selectOption("recogida en tienda");

        const pickupPaymentOptions = await readPaymentMethodOptionValues(storefrontPage);

        expect(pickupPaymentOptions).not.toContain("Contra entrega");
      });

      await test.step("the server also rejects a forged pickup plus contra entrega combination", async () => {
        const invalidAttempt = await createOrderThroughPublicApi(storefrontPage, {
          businessSlug: scenario.businessSlug,
          customerName: invalidCustomerName,
          customerWhatsApp: scenario.customerPhone,
          deliveryType: "recogida en tienda",
          paymentMethod: "Contra entrega",
          total: ownedProduct.price,
          products: [
            {
              productId: ownedProduct.productId,
              name: scenario.productName,
              quantity: 1,
              unitPrice: ownedProduct.price,
            },
          ],
        });

        expect(invalidAttempt.status).toBe(400);
        expect(invalidAttempt.payload).toMatchObject({
          error: "Invalid order payload. Contra entrega solo se permite en pedidos a domicilio.",
        });
      });

      await test.step("a domicilio order can use contra entrega and starts in the expected cash state", async () => {
        await openPublicStorefront(storefrontPage, scenario);
        await storefrontPage
          .getByTestId("storefront-delivery-type-select")
          .selectOption("domicilio");

        const domicilioPaymentOptions = await readPaymentMethodOptionValues(storefrontPage);

        expect(domicilioPaymentOptions).toContain("Contra entrega");

        await createOrderFromPublicStorefront(storefrontPage, scenario, {
          customerName: validCustomerName,
          deliveryType: "domicilio",
          deliveryAddress: "Carrera 45 # 12-34, apto 201",
          paymentMethod: "Contra entrega",
        });

        const domicilioOrder = await waitForOrderInPrivateApi(page, scenario.businessSlug, {
          customerName: validCustomerName,
          productName: scenario.productName,
        });

        expect(
          domicilioOrder.products?.some(
            (product) => product.productId === ownedProduct.productId,
          ),
        ).toBe(true);
        expect(domicilioOrder.paymentMethod).toBe("Contra entrega");
        expect(domicilioOrder.deliveryType).toBe("domicilio");
        expect(domicilioOrder.paymentStatus).toBe("verificado");
        expect(domicilioOrder.status).toBe("nuevo");
        expect(readHistoryTitles(domicilioOrder)).toEqual([
          "Pedido creado desde formulario publico",
          "Pedido registrado",
        ]);

        await page.goto(`/pedidos/${scenario.businessSlug}`);
        await expect(page.getByTestId(`order-card-${domicilioOrder.orderId}`)).toBeVisible();
        await expect(
          page.getByTestId(`order-card-status-${domicilioOrder.orderId}`),
        ).toContainText(
          "Nuevo",
        );
        await expect(
          page.getByTestId(`order-card-financial-condition-${domicilioOrder.orderId}`),
        ).toContainText("Contra entrega");
      });
    } finally {
      await storefrontContext.close();
    }
  });
});
