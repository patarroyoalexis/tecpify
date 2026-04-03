/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { createResolvePostAuthRedirectPath } = loadTsModule("lib/auth/private-workspace.ts");

test("auth redirect: prioridad final respetada entre redirectTo explicito y entrada privada", async () => {
  const resolvePostAuthRedirectPath = createResolvePostAuthRedirectPath({
    resolvePrivateWorkspaceEntry: async (userId) => {
      if (userId === "with-business") {
        return {
          ownedBusinesses: [
            {
              businessId: "biz-1",
              businessSlug: "mi-tienda",
              businessName: "Mi tienda",
              isActive: true,
              updatedAt: "2026-04-02T10:00:00.000Z",
              createdByUserId: userId,
            },
          ],
          activeBusiness: {
            businessId: "biz-1",
            businessSlug: "mi-tienda",
            businessName: "Mi tienda",
            isActive: true,
            updatedAt: "2026-04-02T10:00:00.000Z",
            createdByUserId: userId,
          },
          entryHref: "/dashboard/mi-tienda",
        };
      }

      if (userId === "archived-only") {
        return {
          ownedBusinesses: [
            {
              businessId: "biz-archived",
              businessSlug: "mi-tienda-archivada",
              businessName: "Mi tienda archivada",
              isActive: false,
              updatedAt: "2026-04-02T09:00:00.000Z",
              createdByUserId: userId,
            },
          ],
          activeBusiness: null,
          entryHref: "/onboarding",
        };
      }

      return {
        ownedBusinesses: [],
        activeBusiness: null,
        entryHref: "/onboarding",
      };
    },
  });

  const explicitWorkspace = await resolvePostAuthRedirectPath("with-business", {
    hasExplicitRedirectTo: true,
    redirectTo: "/pedidos/mi-tienda?estado=pendiente",
  });
  assert.equal(explicitWorkspace.redirectTo, "/pedidos/mi-tienda?estado=pendiente");

  const explicitInvalid = await resolvePostAuthRedirectPath("with-business", {
    hasExplicitRedirectTo: true,
    redirectTo: "/login",
  });
  assert.equal(explicitInvalid.redirectTo, "/dashboard/mi-tienda");

  const implicitWithBusiness = await resolvePostAuthRedirectPath("with-business", {
    redirectTo: "/ajustes",
  });
  assert.equal(implicitWithBusiness.redirectTo, "/dashboard/mi-tienda");

  const implicitWithoutBusiness = await resolvePostAuthRedirectPath("without-business", {
    redirectTo: "/ajustes",
  });
  assert.equal(implicitWithoutBusiness.redirectTo, "/onboarding");

  const archivedOnlyBusiness = await resolvePostAuthRedirectPath("archived-only", {
    redirectTo: "/ajustes",
  });
  assert.equal(archivedOnlyBusiness.redirectTo, "/onboarding");
});
