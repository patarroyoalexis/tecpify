import { expect, test } from "@playwright/test";

import {
  archiveAllActiveBusinessesFromSettings,
  archiveBusinessFromSettings,
  createActiveProductFromDrawer,
  createBusinessFromOnboarding,
  createBusinessFromWorkspace,
  createCriticalFlowScenario,
  expectStorefrontBusinessNotFound,
  goToSettingsPage,
  loginThroughUiExpectPath,
  logoutThroughUi,
  openPublicStorefront,
  readBusinessCardsFromSettings,
  resolveTestUsers,
} from "./support/mvp-critical-flow";

const testUsers = resolveTestUsers();

test.describe("Business archive flow", () => {
  test("archiving keeps identity and history, frees the public slug, and sends archived-only owners back to onboarding", async ({
    browser,
    page,
  }) => {
    test.setTimeout(150_000);
    const archivedScenario = createCriticalFlowScenario();
    const replacementScenario = {
      ...createCriticalFlowScenario(),
      businessName: archivedScenario.businessName,
      businessSlug: archivedScenario.businessSlug,
    };
    let archivedBusinessId = "";

    await test.step("owner reaches settings and archives any previous active businesses", async () => {
      await loginThroughUiExpectPath(page, testUsers.owner, {
        redirectTo: "/ajustes",
        expectedPathname: "/ajustes",
      });
      await archiveAllActiveBusinessesFromSettings(page);
    });

    await test.step("owner creates a fresh active business and publishes its first product", async () => {
      await createBusinessFromWorkspace(page, archivedScenario);
      await createActiveProductFromDrawer(page, archivedScenario);
    });

    await test.step("the public storefront works before the archive", async () => {
      const storefrontContext = await browser.newContext();
      const storefrontPage = await storefrontContext.newPage();

      try {
        await openPublicStorefront(storefrontPage, archivedScenario);
      } finally {
        await storefrontContext.close();
      }
    });

    await test.step("archiving moves the business to historical state without deleting it", async () => {
      await goToSettingsPage(page);
      const cardsBeforeArchive = await readBusinessCardsFromSettings(page);
      const activeCard = cardsBeforeArchive.find(
        (card) =>
          card.state === "active" &&
          card.businessSlug === archivedScenario.businessSlug,
      );

      expect(activeCard).toBeDefined();
      archivedBusinessId = activeCard?.businessId ?? "";
      expect(archivedBusinessId).not.toBe("");

      await archiveBusinessFromSettings(page, archivedBusinessId);

      const cardsAfterArchive = await readBusinessCardsFromSettings(page);
      expect(
        cardsAfterArchive.some(
          (card) => card.state === "active" && card.businessId === archivedBusinessId,
        ),
      ).toBe(false);
      expect(cardsAfterArchive).toContainEqual(
        expect.objectContaining({
          businessId: archivedBusinessId,
          businessSlug: archivedScenario.businessSlug,
          state: "inactive",
        }),
      );
    });

    await test.step("the archived slug stops resolving as an operative storefront", async () => {
      const storefrontContext = await browser.newContext();
      const storefrontPage = await storefrontContext.newPage();

      try {
        await expectStorefrontBusinessNotFound(storefrontPage, archivedScenario.businessSlug);
      } finally {
        await storefrontContext.close();
      }
    });

    await test.step("the same owner logs back in and lands on onboarding when only archived businesses remain", async () => {
      await logoutThroughUi(page);
      await loginThroughUiExpectPath(page, testUsers.owner, {
        redirectTo: "/dashboard",
        expectedPathname: "/onboarding",
      });
    });

    await test.step("onboarding creates a new active business instead of recycling the archived row", async () => {
      await createBusinessFromOnboarding(page, replacementScenario, {
        businessType: "Tienda / Retail",
      });
      await goToSettingsPage(page);

      const cardsAfterReplacement = await readBusinessCardsFromSettings(page);
      const replacementActiveCard = cardsAfterReplacement.find(
        (card) =>
          card.state === "active" &&
          card.businessSlug === replacementScenario.businessSlug,
      );

      expect(replacementActiveCard).toBeDefined();
      expect(replacementActiveCard?.businessId).not.toBe(archivedBusinessId);
      expect(cardsAfterReplacement).toContainEqual(
        expect.objectContaining({
          businessId: archivedBusinessId,
          businessSlug: replacementScenario.businessSlug,
          state: "inactive",
        }),
      );
    });

    await test.step("the freed slug becomes operative again for the new active business", async () => {
      const storefrontContext = await browser.newContext();
      const storefrontPage = await storefrontContext.newPage();

      try {
        await openPublicStorefront(storefrontPage, replacementScenario);
      } finally {
        await storefrontContext.close();
      }
    });
  });
});
