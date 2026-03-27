import { test } from "@playwright/test";

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
    test.setTimeout(120_000);
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
});
