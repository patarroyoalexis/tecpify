/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const migrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260330001_introduce_app_roles_and_platform_admin_access.sql",
);
const migrationSource = fs.readFileSync(migrationPath, "utf8");
const authServerSource = fs.readFileSync(path.join(repoRoot, "lib", "auth", "server.ts"), "utf8");
const adminPageSource = fs.readFileSync(path.join(repoRoot, "app", "admin", "page.tsx"), "utf8");
const adminDataSource = fs.readFileSync(
  path.join(repoRoot, "lib", "data", "admin-dashboard.ts"),
  "utf8",
);

test("platform admin sql: la migracion introduce app_role, user_profiles y backfill explicito", () => {
  assert.match(
    migrationSource,
    /create type public\.app_role as enum[\s\S]*'platform_admin'[\s\S]*'business_owner'[\s\S]*'customer'/i,
  );
  assert.match(
    migrationSource,
    /create table if not exists public\.user_profiles[\s\S]*user_id uuid primary key[\s\S]*references auth\.users \(id\)/i,
  );
  assert.match(
    migrationSource,
    /handle_auth_user_profile_defaults/i,
    "La migracion debe crear el trigger que inicializa perfiles para nuevas cuentas.",
  );
  assert.match(
    migrationSource,
    /insert into public\.user_profiles[\s\S]*from auth\.users as users/i,
    "La migracion debe backfillear cuentas existentes sin depender de defaults silenciosos.",
  );
  assert.match(
    migrationSource,
    /insert into public\.user_profiles[\s\S]*from public\.businesses as businesses[\s\S]*on conflict \(user_id\) do update/i,
    "La migracion debe reparar explicitamente a los owners actuales para no romper ownership vigente.",
  );
});

test("platform admin sql: user_profiles y lecturas globales quedan protegidos por funciones y RLS explicitos", () => {
  assert.match(migrationSource, /create or replace function public\.current_app_role\(\)/i);
  assert.match(migrationSource, /create or replace function public\.is_platform_admin\(\)/i);
  assert.match(
    migrationSource,
    /create policy "authenticated can read own or admin user profiles"[\s\S]*user_id = auth\.uid\(\)[\s\S]*or public\.is_platform_admin\(\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can read owned businesses"[\s\S]*or public\.is_platform_admin\(\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can read accessible products"[\s\S]*public\.is_platform_admin\(\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can read accessible orders"[\s\S]*public\.is_platform_admin\(\)/i,
  );
  assert.match(
    migrationSource,
    /grant select on public\.user_profiles to authenticated;/i,
  );
  assert.match(
    migrationSource,
    /grant execute on function public\.current_app_role\(\) to authenticated;/i,
  );
  assert.match(
    migrationSource,
    /grant execute on function public\.is_platform_admin\(\) to authenticated;/i,
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.upsert_user_profile_role\(uuid, public\.app_role\)[\s\S]*authenticated/i,
    "La asignacion manual de roles no debe quedar expuesta al runtime autenticado.",
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.upsert_user_profile_role_by_email\(text, public\.app_role\)[\s\S]*authenticated/i,
    "La asignacion por email debe quedar reservada al carril privilegiado/manual.",
  );
});

test("platform admin runtime: /admin y la capa de datos exigen platform_admin server-side", () => {
  assert.match(authServerSource, /requirePlatformAdmin\(/);
  assert.match(authServerSource, /requirePlatformAdminApiUser\(/);
  assert.match(
    authServerSource,
    /No tienes acceso al panel interno de plataforma\./,
    "El guard API debe bloquear no-admins con un mensaje explicito.",
  );
  assert.match(adminPageSource, /requirePlatformAdmin\("\/admin"\)/);
  assert.match(adminPageSource, /getAdminDashboardSnapshot\(platformAdmin\)/);
  assert.match(adminPageSource, /unauthorized-admin-access/);
  assert.match(adminDataSource, /assertPlatformAdminAccess\(viewer\)/);
  assert.match(
    adminDataSource,
    /\.from\("user_profiles"\)[\s\S]*\.from\("businesses"\)[\s\S]*\.from\("products"\)[\s\S]*\.from\("orders"\)/,
    "La capa admin debe centralizar las lecturas globales en un solo modulo protegido.",
  );
});
