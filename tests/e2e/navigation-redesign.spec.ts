import { expect, test } from "@playwright/test";
import { loginThroughUi, resolveTestUsers } from "./support/mvp-critical-flow";

const testUsers = resolveTestUsers();

test.describe("Navigation Redesign", () => {
  test("workspace navigation shows sidebar and topbar with business info and page title", async ({ page }) => {
    // 1. Login
    await loginThroughUi(page, testUsers.owner);

    // 2. We should be in /ajustes or /dashboard
    // If the user has a business, they go to /dashboard/slug, if not /ajustes
    // Let's assume the test user has a business or we just check the structure
    
    // Check Topbar structure
    await expect(page.locator('header.sticky.top-0.h-16')).toBeVisible();
    await expect(page.locator('header img[alt="Tecpify"]')).toBeVisible();
    await expect(page.getByTestId("workspace-current-business-name")).toBeVisible();
    await expect(page.getByTestId("workspace-page-title")).toBeVisible();

    // Check Sidebar structure
    await expect(page.getByTestId("workspace-sidebar")).toBeVisible();
    
    // Check Sidebar links (Desktop only, which is default for Playwright unless configured)
    await expect(page.getByTestId("sidebar-link-dashboard")).toBeVisible();
    await expect(page.getByTestId("sidebar-link-pedidos")).toBeVisible();
    await expect(page.getByTestId("sidebar-link-metricas")).toBeVisible();
    await expect(page.getByTestId("sidebar-link-ajustes")).toBeVisible();

    // Verify "Nuevo" and "Ajustes" buttons are NOT in the top bar
    // They used to have specific test IDs or text
    await expect(page.getByTestId("workspace-settings-trigger")).toHaveCount(0); // Old "Ajustes" menu
    await expect(page.getByText("Nuevo", { exact: true })).toHaveCount(0); // Old "Nuevo" button text
  });

  test("navigation between sections updates the page title in the top bar", async ({ page }) => {
    await loginThroughUi(page, testUsers.owner);

    // Navigate to Pedidos (if business exists, or find it)
    // For this test, let's just click the sidebar link and check if title updates
    const pedidosLink = page.getByTestId("sidebar-link-pedidos");
    if (await pedidosLink.count() > 0) {
      await pedidosLink.click();
      await expect(page.getByTestId("workspace-page-title")).toContainText("Pedidos");
    }

    const metricasLink = page.getByTestId("sidebar-link-metricas");
    if (await metricasLink.count() > 0) {
      await metricasLink.click();
      await expect(page.getByTestId("workspace-page-title")).toContainText("Métricas");
    }

    const ajustesLink = page.getByTestId("sidebar-link-ajustes");
    await ajustesLink.click();
    await expect(page.getByTestId("workspace-page-title")).toContainText("Ajustes");
  });
});
