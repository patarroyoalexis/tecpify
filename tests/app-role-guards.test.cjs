/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const rolesSource = fs.readFileSync(path.join(repoRoot, "lib", "auth", "roles.ts"), "utf8");
const {
  APP_ROLES,
  MVP_ENABLED_APP_ROLES,
  isAppRole,
  isMvpEnabledAppRole,
  isPlatformAdminRole,
  canAccessBusinessWorkspaceRole,
} = loadTsModule("lib/auth/roles.ts");

test("app roles: el contrato central contempla exactamente platform_admin, business_owner y customer", () => {
  assert.deepEqual(APP_ROLES, ["platform_admin", "business_owner", "customer"]);
  assert.deepEqual(MVP_ENABLED_APP_ROLES, ["platform_admin", "business_owner"]);
  assert.match(rolesSource, /APP_ROLES = \["platform_admin", "business_owner", "customer"\]/);
  assert.doesNotMatch(
    rolesSource,
    /"user"/,
    "El contrato central de roles no puede reintroducir `user` como rol valido.",
  );
});

test("app roles: los guards semanticos rechazan `user` y bloquean customer fuera del workspace", () => {
  assert.equal(isAppRole("platform_admin"), true);
  assert.equal(isAppRole("business_owner"), true);
  assert.equal(isAppRole("customer"), true);
  assert.equal(isAppRole("user"), false);
  assert.equal(isMvpEnabledAppRole("platform_admin"), true);
  assert.equal(isMvpEnabledAppRole("business_owner"), true);
  assert.equal(isMvpEnabledAppRole("customer"), false);
  assert.equal(isPlatformAdminRole("platform_admin"), true);
  assert.equal(isPlatformAdminRole("business_owner"), false);
  assert.equal(canAccessBusinessWorkspaceRole("platform_admin"), true);
  assert.equal(canAccessBusinessWorkspaceRole("business_owner"), true);
  assert.equal(canAccessBusinessWorkspaceRole("customer"), false);
});
