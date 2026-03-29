import { expect, test } from "@playwright/test";

import { loginThroughUi, resolveTestUsers } from "./support/mvp-critical-flow";

const proxyUsers = resolveTestUsers();

test.describe("Proxy route protection", () => {
  test("public routes stay public and private routes redirect unauthenticated users to login", async ({
    page,
  }) => {
    await test.step("public login and register routes remain reachable without auth", async () => {
      await page.goto("/login");
      await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
      await expect(page.getByTestId("login-form")).toBeVisible();

      await page.goto("/register");
      await expect(page).toHaveURL(/\/register(?:\?.*)?$/);
      await expect(page.getByRole("heading", { name: "Registro manual" })).toBeVisible();
      await expect(page.getByTestId("register-secondary-warning")).toBeVisible();
    });

    await test.step("private route prefixes redirect to login and preserve redirectTo", async () => {
      const protectedRoutes = [
        "/dashboard",
        "/pedidos/negocio-proxy?estado=pendiente",
        "/metricas/negocio-proxy?tab=ventas",
      ];

      for (const protectedRoute of protectedRoutes) {
        await page.goto(protectedRoute);
        await page.waitForURL((url) => url.pathname === "/login");

        const redirectedUrl = new URL(page.url());
        expect(redirectedUrl.searchParams.get("redirectTo")).toBe(protectedRoute);
        await expect(page.getByTestId("login-form")).toBeVisible();
      }
    });
  });

  test("auth sigue operativo despues de la migracion y el owner entra a dashboard", async ({
    page,
  }) => {
    await loginThroughUi(page, proxyUsers.owner);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("create-business-panel")).toBeVisible();
  });
});
