/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const migrationSource = fs.readFileSync(
  path.join(
    repoRoot,
    "supabase",
    "migrations",
    "20260327001_grant_operational_runtime_privileges.sql",
  ),
  "utf8",
);

test("db privileges: negocios, productos y pedidos exponen solo los grants operativos minimos", () => {
  assert.match(
    migrationSource,
    /grant usage on schema public to anon, authenticated;/i,
    "El runtime normal debe poder usar el schema public sin abrir service role.",
  );
  assert.match(
    migrationSource,
    /grant select on public\.businesses to anon, authenticated;/i,
    "La lectura operativa de negocios debe quedar disponible para anon/authenticated bajo RLS.",
  );
  assert.match(
    migrationSource,
    /grant insert on public\.businesses to authenticated;/i,
    "El owner autenticado debe poder crear negocios reales bajo RLS.",
  );
  assert.match(
    migrationSource,
    /grant select on public\.products to anon, authenticated;/i,
    "El storefront y el workspace deben poder leer productos reales bajo RLS.",
  );
  assert.match(
    migrationSource,
    /grant insert, update, delete on public\.products to authenticated;/i,
    "La mutacion operativa de productos debe quedar expuesta solo al borde autenticado.",
  );
  assert.match(
    migrationSource,
    /grant select on public\.orders to authenticated;/i,
    "La lectura privada de pedidos debe permanecer en el borde autenticado.",
  );
  assert.match(
    migrationSource,
    /grant insert on public\.orders to anon, authenticated;/i,
    "El storefront publico y el workspace deben poder crear pedidos bajo sus politicas RLS.",
  );
  assert.match(
    migrationSource,
    /grant update on public\.orders to authenticated;/i,
    "La mutacion privada de pedidos debe quedar disponible solo para autenticados.",
  );
});
