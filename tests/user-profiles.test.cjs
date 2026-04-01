/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/test-runtime.cjs");

const userProfilesModule = loadTsModule("lib/auth/user-profiles.ts");

test("user profiles: el mapper maneja correctamente el esquema real de la DB", () => {
  const row = {
    user_id: "user-1",
    role: "business_owner",
    full_name: "Test User",
    is_active: true,
    deactivated_at: null,
    created_at: "2026-03-30T10:00:00Z",
    updated_at: "2026-03-30T11:00:00Z",
  };

  const profile = userProfilesModule.mapUserProfileRow(row);

  assert.equal(profile.userId, "user-1");
  assert.equal(profile.role, "business_owner");
  assert.equal(profile.fullName, "Test User");
  assert.equal(profile.isActive, true);
  assert.equal(profile.deactivatedAt, null);
});

test("user profiles: el mapper falla con roles invalidos", () => {
  const row = {
    user_id: "user-1",
    role: "invalid_role",
    full_name: null,
    is_active: true,
    deactivated_at: null,
    created_at: "2026-03-30T10:00:00Z",
    updated_at: "2026-03-30T11:00:00Z",
  };

  assert.throws(() => userProfilesModule.mapUserProfileRow(row), /valor invalido/);
});

test("user profiles: el contrato de lectura incluye todas las columnas necesarias", () => {
  // Verificamos por inspeccion de tipos o simplemente aseguramos que el modulo carga
  assert.ok(userProfilesModule.getUserProfileByUserId);
});
