import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  createBusinessThroughPrivateApi,
  createCriticalFlowScenario,
  createManualOrderThroughPrivateApi,
  createProductThroughPrivateApi,
  loginThroughUi,
  resolveTestUsers,
  updateBusinessSettingsThroughPrivateApi,
  updateOrderThroughPrivateApi,
  waitForOrderInPrivateApi,
  waitForProductInPrivateApi,
} from "./support/mvp-critical-flow";

const metricsUsers = resolveTestUsers();

function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

async function expectNormalizedText(locator: Locator, expected: string) {
  await expect.poll(async () => normalizeText(await locator.textContent())).toBe(
    normalizeText(expected),
  );
}

function readApiPayloadSummary(payload: unknown) {
  if (payload === null || payload === undefined) {
    return "<sin payload>";
  }

  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

async function expectApiStatus(
  attempt: { status: number; payload: unknown },
  expectedStatus: number,
  label: string,
) {
  expect(
    attempt.status,
    `${label} devolvio ${attempt.status} con payload=${readApiPayloadSummary(attempt.payload)}`,
  ).toBe(expectedStatus);
}

async function createBusiness(page: Page, scenario: ReturnType<typeof createCriticalFlowScenario>) {
  const attempt = await createBusinessThroughPrivateApi(page, {
    name: scenario.businessName,
    businessSlug: scenario.businessSlug,
  });

  await expectApiStatus(attempt, 201, `Crear negocio ${scenario.businessSlug}`);
}

async function createActiveProduct(
  page: Page,
  scenario: ReturnType<typeof createCriticalFlowScenario>,
) {
  const attempt = await createProductThroughPrivateApi(page, {
    businessSlug: scenario.businessSlug,
    name: scenario.productName,
    description: `Producto persistido para metricas privadas ${scenario.productName}`,
    price: scenario.productPrice,
    isAvailable: true,
  });

  await expectApiStatus(attempt, 201, `Crear producto ${scenario.productName}`);

  return waitForProductInPrivateApi(page, scenario.businessSlug, scenario.productName);
}

async function enableFiadoForBusiness(
  page: Page,
  scenario: ReturnType<typeof createCriticalFlowScenario>,
) {
  const attempt = await updateBusinessSettingsThroughPrivateApi(page, {
    businessSlug: scenario.businessSlug,
    transferInstructions: "Nequi 3001234567. Envia comprobante por WhatsApp.",
    acceptsCash: true,
    acceptsTransfer: true,
    acceptsCard: true,
    allowsFiado: true,
  });

  await expectApiStatus(attempt, 200, `Actualizar negocio ${scenario.businessSlug}`);
}

async function createManualOrder(
  page: Page,
  options: {
    businessSlug: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    customerName: string;
    customerWhatsApp: string;
    paymentMethod: "Efectivo" | "Transferencia";
  },
) {
  const total = options.quantity * options.unitPrice;
  const attempt = await createManualOrderThroughPrivateApi(page, {
    businessSlug: options.businessSlug,
    customerName: options.customerName,
    customerWhatsApp: options.customerWhatsApp,
    deliveryType: "recogida en tienda",
    paymentMethod: options.paymentMethod,
    total,
    products: [
      {
        productId: options.productId,
        name: options.productName,
        quantity: options.quantity,
        unitPrice: options.unitPrice,
      },
    ],
  });

  await expectApiStatus(
    attempt,
    201,
    `Crear pedido manual ${options.customerName} para ${options.businessSlug}`,
  );

  const order = await waitForOrderInPrivateApi(page, options.businessSlug, {
    customerName: options.customerName,
    productName: options.productName,
  });

  if (!order.orderId) {
    throw new Error(`No fue posible resolver el orderId para ${options.customerName}.`);
  }

  return order.orderId;
}

async function patchOrder(
  page: Page,
  orderId: string,
  payload: Record<string, unknown>,
  label: string,
) {
  const attempt = await updateOrderThroughPrivateApi(page, orderId, payload);
  await expectApiStatus(attempt, 200, label);
}

async function advanceCashOrderToDelivered(
  page: Page,
  businessSlug: string,
  orderId: string,
) {
  for (const status of ["confirmado", "en preparación", "listo", "entregado"] as const) {
    await patchOrder(page, orderId, { status }, `Actualizar ${orderId} -> ${status}`);
    await waitForOrderInPrivateApi(page, businessSlug, { orderId, status });
  }
}

async function cancelOrder(page: Page, businessSlug: string, orderId: string) {
  await patchOrder(
    page,
    orderId,
    { status: "cancelado", cancellationReason: "pedido_duplicado" },
    `Cancelar ${orderId}`,
  );
  await waitForOrderInPrivateApi(page, businessSlug, { orderId, status: "cancelado" });
}

async function markOrderAsPendingFiado(
  page: Page,
  businessSlug: string,
  orderId: string,
  fiadoObservation: string,
) {
  await patchOrder(
    page,
    orderId,
    {
      isFiado: true,
      fiadoStatus: "pending",
      fiadoObservation,
    },
    `Marcar ${orderId} como fiado pendiente`,
  );
  await waitForOrderInPrivateApi(page, businessSlug, { orderId, status: "entregado" });
}

async function markOrderAsPaidFiado(page: Page, businessSlug: string, orderId: string) {
  await patchOrder(
    page,
    orderId,
    {
      fiadoStatus: "paid",
    },
    `Marcar ${orderId} como fiado pagado`,
  );
  await waitForOrderInPrivateApi(page, businessSlug, { orderId, status: "entregado" });
}

async function assertMetricsView(
  page: Page,
  expected: {
    ordersInCutoff: number;
    pendingActions: number;
    inOperation: number;
    deliveredRevenue: number;
    pendingPayments: number;
    activeLoad: number;
    cutoffRevenue: number;
    cancellations: number;
    averageTicket: number;
    topProductName: string;
    topProductQuantity: number;
    pendingFiadoCount?: number;
  },
) {
  const metricsRoot = page.getByTestId("metrics-overview");
  await expect(metricsRoot).toBeVisible();
  await expect(metricsRoot.getByTestId("metrics-reference-cutoff")).toBeVisible();

  await expectNormalizedText(
    metricsRoot.getByTestId("metric-card-pedidos-del-corte-value"),
    `${expected.ordersInCutoff}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metric-card-pendientes-de-atencion-value"),
    `${expected.pendingActions}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metric-card-en-operacion-value"),
    `${expected.inOperation}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metric-card-ingresos-entregados-value"),
    formatCop(expected.deliveredRevenue),
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-focus-item-cobros-por-revisar-value"),
    `${expected.pendingPayments}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-focus-item-carga-activa-value"),
    `${expected.activeLoad}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-focus-item-venta-del-corte-value"),
    formatCop(expected.cutoffRevenue),
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-focus-item-cancelaciones-value"),
    `${expected.cancellations}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-average-ticket-value"),
    formatCop(expected.averageTicket),
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-top-product-1-name"),
    `1. ${expected.topProductName}`,
  );
  await expectNormalizedText(
    metricsRoot.getByTestId("metrics-top-product-1-quantity"),
    `${expected.topProductQuantity} unidad${expected.topProductQuantity === 1 ? "" : "es"}`,
  );

  if (expected.pendingFiadoCount && expected.pendingFiadoCount > 0) {
    await expect(metricsRoot.getByTestId("metrics-pending-fiado-banner")).toContainText(
      `${expected.pendingFiadoCount} fiado`,
    );
  } else {
    await expect(metricsRoot.getByTestId("metrics-pending-fiado-banner")).toHaveCount(0);
  }
}

test.describe("Private metrics", () => {
  test("owner sees persisted private metrics without cross-business leakage, localStorage dependence, or pending fiado in effective revenue", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const primaryScenario = createCriticalFlowScenario();
    const secondaryScenario = createCriticalFlowScenario();
    const baseURL = testInfo.project.use.baseURL;

    primaryScenario.productPrice = 10_000;
    secondaryScenario.productPrice = 7_000;

    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error("Playwright baseURL debe estar configurada para abrir las rutas privadas.");
    }

    await test.step("owner logs in and creates two persisted businesses with active products", async () => {
      await loginThroughUi(page, metricsUsers.owner);
      await createBusiness(page, primaryScenario);
      await createBusiness(page, secondaryScenario);

      const [primaryProduct, secondaryProduct] = await Promise.all([
        createActiveProduct(page, primaryScenario),
        createActiveProduct(page, secondaryScenario),
      ]);

      if (!primaryProduct.productId || !secondaryProduct.productId) {
        throw new Error("No fue posible resolver los productId reales para las metricas.");
      }

      await enableFiadoForBusiness(page, primaryScenario);

      const primaryDeliveredOrderId = await createManualOrder(page, {
        businessSlug: primaryScenario.businessSlug,
        productId: primaryProduct.productId,
        productName: primaryScenario.productName,
        unitPrice: primaryScenario.productPrice,
        quantity: 1,
        customerName: `${primaryScenario.customerName} entregado`,
        customerWhatsApp: primaryScenario.customerPhone,
        paymentMethod: "Efectivo",
      });
      await advanceCashOrderToDelivered(
        page,
        primaryScenario.businessSlug,
        primaryDeliveredOrderId,
      );

      await createManualOrder(page, {
        businessSlug: primaryScenario.businessSlug,
        productId: primaryProduct.productId,
        productName: primaryScenario.productName,
        unitPrice: primaryScenario.productPrice,
        quantity: 2,
        customerName: `${primaryScenario.customerName} transferencia`,
        customerWhatsApp: primaryScenario.customerPhone,
        paymentMethod: "Transferencia",
      });

      const pendingFiadoOrderId = await createManualOrder(page, {
        businessSlug: primaryScenario.businessSlug,
        productId: primaryProduct.productId,
        productName: primaryScenario.productName,
        unitPrice: primaryScenario.productPrice,
        quantity: 3,
        customerName: `${primaryScenario.customerName} fiado pendiente`,
        customerWhatsApp: primaryScenario.customerPhone,
        paymentMethod: "Efectivo",
      });
      await advanceCashOrderToDelivered(page, primaryScenario.businessSlug, pendingFiadoOrderId);
      await markOrderAsPendingFiado(
        page,
        primaryScenario.businessSlug,
        pendingFiadoOrderId,
        "Paga manana sin entrar a ingresos efectivos.",
      );

      const cancelledOrderId = await createManualOrder(page, {
        businessSlug: primaryScenario.businessSlug,
        productId: primaryProduct.productId,
        productName: primaryScenario.productName,
        unitPrice: primaryScenario.productPrice,
        quantity: 4,
        customerName: `${primaryScenario.customerName} cancelado`,
        customerWhatsApp: primaryScenario.customerPhone,
        paymentMethod: "Efectivo",
      });
      await cancelOrder(page, primaryScenario.businessSlug, cancelledOrderId);

      const paidFiadoOrderId = await createManualOrder(page, {
        businessSlug: primaryScenario.businessSlug,
        productId: primaryProduct.productId,
        productName: primaryScenario.productName,
        unitPrice: primaryScenario.productPrice,
        quantity: 5,
        customerName: `${primaryScenario.customerName} fiado pagado`,
        customerWhatsApp: primaryScenario.customerPhone,
        paymentMethod: "Efectivo",
      });
      await advanceCashOrderToDelivered(page, primaryScenario.businessSlug, paidFiadoOrderId);
      await markOrderAsPendingFiado(
        page,
        primaryScenario.businessSlug,
        paidFiadoOrderId,
        "Queda pendiente antes de marcarlo pagado.",
      );
      await markOrderAsPaidFiado(page, primaryScenario.businessSlug, paidFiadoOrderId);

      const secondaryDeliveredOrderId = await createManualOrder(page, {
        businessSlug: secondaryScenario.businessSlug,
        productId: secondaryProduct.productId,
        productName: secondaryScenario.productName,
        unitPrice: secondaryScenario.productPrice,
        quantity: 7,
        customerName: `${secondaryScenario.customerName} entregado`,
        customerWhatsApp: secondaryScenario.customerPhone,
        paymentMethod: "Efectivo",
      });
      await advanceCashOrderToDelivered(
        page,
        secondaryScenario.businessSlug,
        secondaryDeliveredOrderId,
      );
    });

    await test.step("owner sees exact metrics for the primary business", async () => {
      await page.goto(`/metricas/${primaryScenario.businessSlug}`);
      await expect(page).toHaveURL(new RegExp(`/metricas/${primaryScenario.businessSlug}$`));

      await assertMetricsView(page, {
        ordersInCutoff: 5,
        pendingActions: 1,
        inOperation: 0,
        deliveredRevenue: 60_000,
        pendingPayments: 1,
        activeLoad: 0,
        cutoffRevenue: 80_000,
        cancellations: 1,
        averageTicket: 80_000 / 3,
        topProductName: primaryScenario.productName,
        topProductQuantity: 11,
        pendingFiadoCount: 1,
      });
    });

    await test.step("owner sees isolated metrics for the secondary business", async () => {
      await page.goto(`/metricas/${secondaryScenario.businessSlug}`);
      await expect(page).toHaveURL(new RegExp(`/metricas/${secondaryScenario.businessSlug}$`));

      await assertMetricsView(page, {
        ordersInCutoff: 1,
        pendingActions: 0,
        inOperation: 0,
        deliveredRevenue: 49_000,
        pendingPayments: 0,
        activeLoad: 0,
        cutoffRevenue: 49_000,
        cancellations: 0,
        averageTicket: 49_000,
        topProductName: secondaryScenario.productName,
        topProductQuantity: 7,
      });
    });

    await test.step("a fresh owner session still resolves the same metrics with empty localStorage", async () => {
      const cleanOwnerContext = await browser.newContext({ baseURL });
      await cleanOwnerContext.addInitScript(() => {
        window.localStorage.clear();
      });
      const cleanOwnerPage = await cleanOwnerContext.newPage();

      try {
        await loginThroughUi(cleanOwnerPage, metricsUsers.owner);
        await cleanOwnerPage.goto(`/metricas/${primaryScenario.businessSlug}`);
        await expect(cleanOwnerPage).toHaveURL(
          new RegExp(`/metricas/${primaryScenario.businessSlug}$`),
        );
        expect(await cleanOwnerPage.evaluate(() => window.localStorage.length)).toBe(0);

        await assertMetricsView(cleanOwnerPage, {
          ordersInCutoff: 5,
          pendingActions: 1,
          inOperation: 0,
          deliveredRevenue: 60_000,
          pendingPayments: 1,
          activeLoad: 0,
          cutoffRevenue: 80_000,
          cancellations: 1,
          averageTicket: 80_000 / 3,
          topProductName: primaryScenario.productName,
          topProductQuantity: 11,
          pendingFiadoCount: 1,
        });
      } finally {
        await cleanOwnerContext.close();
      }
    });

    await test.step("another authenticated user stays blocked from the owner metrics and source data", async () => {
      const intruderContext = await browser.newContext({ baseURL });
      const intruderPage = await intruderContext.newPage();

      try {
        await loginThroughUi(intruderPage, metricsUsers.intruder);
        await intruderPage.goto(`/metricas/${primaryScenario.businessSlug}`);
        await expect(intruderPage.getByTestId("unauthorized-business-access")).toBeVisible();

        const ordersAttempt = await intruderPage.evaluate(async (businessSlug) => {
          const response = await fetch(
            `/api/orders?businessSlug=${encodeURIComponent(businessSlug)}`,
          );

          return {
            status: response.status,
            payload: await response.json().catch(() => null),
          };
        }, primaryScenario.businessSlug);

        expect(ordersAttempt.status).toBe(403);
        expect(ordersAttempt.payload).toMatchObject({
          error: "No tienes acceso a este negocio.",
        });
      } finally {
        await intruderContext.close();
      }
    });
  });
});
