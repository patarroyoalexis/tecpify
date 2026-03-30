/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  getCurrentUser,
  requireBusinessOperatorApiUser,
  requirePlatformAdminApiUser,
} = loadTsModule("lib/auth/server.ts");

function createSupabaseAuthClient({
  userId = "user-1",
  email = "operator@example.com",
  role = "business_owner",
  unauthenticated = false,
} = {}) {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: unauthenticated ? null : { id: userId, email },
          },
          error: null,
        };
      },
    },
    from(table) {
      assert.equal(table, "user_profiles");

      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "user_id");
              assert.equal(value, userId);

              return {
                async maybeSingle() {
                  return {
                    data: unauthenticated
                      ? null
                      : {
                          user_id: userId,
                          role,
                          created_at: "2026-03-30T12:00:00.000Z",
                          updated_at: "2026-03-30T12:00:00.000Z",
                        },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("admin access: getCurrentUser resuelve el rol persistido desde user_profiles", async () => {
  const user = await getCurrentUser(
    createSupabaseAuthClient({ userId: "admin-1", role: "platform_admin" }),
  );

  assert.equal(user?.userId, "admin-1");
  assert.equal(user?.role, "platform_admin");
  assert.equal(user?.email, "operator@example.com");
});

test("admin access: requirePlatformAdminApiUser permite platform_admin y bloquea business_owner", async () => {
  const adminResult = await requirePlatformAdminApiUser(
    createSupabaseAuthClient({ userId: "admin-1", role: "platform_admin" }),
  );
  const ownerResult = await requirePlatformAdminApiUser(
    createSupabaseAuthClient({ userId: "owner-1", role: "business_owner" }),
  );
  const anonymousResult = await requirePlatformAdminApiUser(
    createSupabaseAuthClient({ unauthenticated: true }),
  );

  assert.equal(adminResult.ok, true);
  assert.equal(adminResult.user.role, "platform_admin");

  assert.equal(ownerResult.ok, false);
  assert.equal(ownerResult.response.status, 403);
  assert.deepEqual(await ownerResult.response.json(), {
    error: "No tienes acceso al panel interno de plataforma.",
  });

  assert.equal(anonymousResult.ok, false);
  assert.equal(anonymousResult.response.status, 401);
  assert.deepEqual(await anonymousResult.response.json(), {
    error: "Debes iniciar sesion para usar este espacio operativo.",
  });
});

test("admin access: requireBusinessOperatorApiUser rechaza customer y acepta owner/admin", async () => {
  const ownerResult = await requireBusinessOperatorApiUser(
    createSupabaseAuthClient({ userId: "owner-1", role: "business_owner" }),
  );
  const adminResult = await requireBusinessOperatorApiUser(
    createSupabaseAuthClient({ userId: "admin-1", role: "platform_admin" }),
  );
  const customerResult = await requireBusinessOperatorApiUser(
    createSupabaseAuthClient({ userId: "customer-1", role: "customer" }),
  );

  assert.equal(ownerResult.ok, true);
  assert.equal(ownerResult.user.role, "business_owner");
  assert.equal(adminResult.ok, true);
  assert.equal(adminResult.user.role, "platform_admin");

  assert.equal(customerResult.ok, false);
  assert.equal(customerResult.response.status, 403);
  assert.deepEqual(await customerResult.response.json(), {
    error: "Tu rol autenticado no puede operar workspaces de negocio.",
  });
});
