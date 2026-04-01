/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { DEFAULT_PRIVATE_REDIRECT_PATH } = loadTsModule("lib/auth/redirect-path.ts");
const { createResolvePrivateWorkspaceEntry } = loadTsModule("lib/auth/private-workspace.ts");
const { createBusinessesRouteHandlers } = loadTsModule("app/api/businesses/route.ts");

const OWNER_ID = "user-owner";
const BUSINESS_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101";

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createOwnedBusinessSummary(overrides = {}) {
  return {
    businessId: BUSINESS_ID,
    businessSlug: "mi-tienda",
    businessName: "Mi tienda",
    isActive: true,
    deactivatedAt: null,
    updatedAt: "2026-03-25T21:00:00.000Z",
    createdByUserId: OWNER_ID,
    ...overrides,
  };
}

test("ajustes: DEFAULT_PRIVATE_REDIRECT_PATH es /ajustes", () => {
  assert.equal(DEFAULT_PRIVATE_REDIRECT_PATH, "/ajustes");
});

test("ajustes: resolvePrivateWorkspaceEntry envia al alta si no hay negocios", async () => {
  const resolvePrivateWorkspaceEntry = createResolvePrivateWorkspaceEntry({
    getOwnedBusinessesForUser: async () => [],
  });

  const result = await resolvePrivateWorkspaceEntry(OWNER_ID);
  // CREATE_BUSINESS_ROUTE should be /ajustes/crear-negocio
  assert.equal(result.ownedBusinesses.length, 0);
  assert.equal(result.entryHref, "/ajustes/crear-negocio");
});

test("ajustes: PATCH /api/businesses permite cambiar el nombre", async () => {
  let updatePayload = null;
  const handlers = createBusinessesRouteHandlers({
    requireBusinessSlug: (s) => s,
    requireBusinessApiContext: async () => ({
      ok: true,
      context: { businessId: BUSINESS_ID, businessSlug: "mi-tienda" }
    }),
    requireBusinessOperatorApiUser: async () => ({ ok: true, user: { userId: OWNER_ID } }),
    createServerSupabaseAuthClient: async () => ({
      from() {
        return {
          update(p) {
            updatePayload = p;
            return {
              eq() {
                return {
                  select() {
                    return {
                      async single() {
                        return { data: { id: BUSINESS_ID, slug: "mi-tienda", name: "Nuevo Nombre", is_active: true }, error: null };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => BUSINESS_ID,
    getNow: () => "2026-03-30T10:00:00Z",
  });

  const response = await handlers.PATCH(
    createJsonRequest("http://localhost/api/businesses", "PATCH", {
      businessSlug: "mi-tienda",
      name: "Nuevo Nombre"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(updatePayload.name, "Nuevo Nombre");
});

test("ajustes: DELETE /api/businesses ejecuta rpc deactivate_business", async () => {
  let rpcCalled = null;
  const handlers = createBusinessesRouteHandlers({
    requireBusinessOperatorApiUser: async () => ({ ok: true, user: { userId: OWNER_ID } }),
    createServerSupabaseAuthClient: async () => ({
      rpc(name, params) {
        rpcCalled = { name, params };
        return { error: null };
      }
    }),
    debugError: () => {},
    debugLog: () => {},
  });

  const response = await handlers.DELETE(
    createJsonRequest("http://localhost/api/businesses", "DELETE", {
      businessSlug: "mi-tienda"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(rpcCalled.name, "deactivate_business");
  assert.equal(rpcCalled.params.target_business_slug, "mi-tienda");
});
