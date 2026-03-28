import { expect, test, type Page } from "@playwright/test";

import { loginThroughUi, resolveTestUsers } from "./support/mvp-critical-flow";

const ownerlessGuardrailUsers = resolveTestUsers();

const LEGACY_REMEDIATION_RUNTIME_SURFACES = [
  {
    path: "/api/businesses/legacy-remediation/request",
    method: "POST",
    body: {},
  },
  {
    path: "/api/businesses/legacy-remediation/grant",
    method: "POST",
    body: {},
  },
  {
    path: "/api/businesses/legacy-remediation/claim",
    method: "POST",
    body: {},
  },
  {
    path: "/api/businesses/legacy-remediation/list",
    method: "GET",
  },
] as const;

interface RuntimeSurfaceAttempt {
  path: string;
  method: string;
  body?: unknown;
}

interface RuntimeSurfaceResponse {
  path: string;
  method: string;
  status: number;
}

async function requestLegacyRuntimeSurfaces(page: Page): Promise<RuntimeSurfaceResponse[]> {
  return page.evaluate(async (attempts: readonly RuntimeSurfaceAttempt[]) => {
    return Promise.all(
      attempts.map(async (attempt) => {
        const response = await fetch(attempt.path, {
          method: attempt.method,
          headers:
            attempt.body === undefined
              ? undefined
              : {
                  "Content-Type": "application/json",
                },
          body: attempt.body === undefined ? undefined : JSON.stringify(attempt.body),
        });

        return {
          path: attempt.path,
          method: attempt.method,
          status: response.status,
        };
      }),
    );
  }, LEGACY_REMEDIATION_RUNTIME_SURFACES);
}

test.describe("Legacy ownerless guardrails", () => {
  test("runtime y workspace no reexponen request/grant/claim/list legacy", async ({ page }) => {
    await page.goto("/");

    const anonymousResponses = await requestLegacyRuntimeSurfaces(page);

    for (const response of anonymousResponses) {
      expect(response.status, `${response.method} ${response.path}`).toBe(404);
    }

    await loginThroughUi(page, ownerlessGuardrailUsers.owner);
    await page.goto("/dashboard");

    await expect(page.locator('[href*="legacy-remediation"]')).toHaveCount(0);

    for (const forbiddenText of [
      "Solicitar remediacion legacy",
      "Reclamar ownership",
      "Habilitar claim controlado",
    ]) {
      await expect(page.getByText(forbiddenText, { exact: false })).toHaveCount(0);
    }

    const authenticatedResponses = await requestLegacyRuntimeSurfaces(page);

    for (const response of authenticatedResponses) {
      expect(response.status, `${response.method} ${response.path}`).toBe(404);
    }
  });
});
