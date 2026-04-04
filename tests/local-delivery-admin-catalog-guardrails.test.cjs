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
  "20260404001_add_local_delivery_neighborhoods.sql",
);
const localDeliverySource = fs.readFileSync(
  path.join(repoRoot, "lib", "data", "local-delivery.ts"),
  "utf8",
);
const apiSource = fs.readFileSync(
  path.join(repoRoot, "app", "api", "admin", "local-delivery", "catalog", "route.ts"),
  "utf8",
);

test("local delivery admin catalog: la migracion crea el contrato exacto de local_delivery_neighborhoods", () => {
  const migrationSource = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    migrationSource,
    /create table if not exists public\.local_delivery_neighborhoods\s*\([\s\S]*id uuid primary key[\s\S]*city_key text not null[\s\S]*city_name text not null[\s\S]*name text not null[\s\S]*latitude double precision not null[\s\S]*longitude double precision not null[\s\S]*is_active boolean not null default true[\s\S]*\);/i,
  );
  assert.match(
    migrationSource,
    /create unique index if not exists local_delivery_neighborhoods_city_key_name_key[\s\S]*lower\(btrim\(city_key\)\)[\s\S]*lower\(btrim\(name\)\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "public can read active local delivery neighborhoods"[\s\S]*to anon[\s\S]*using \(is_active = true\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can read local delivery neighborhoods"[\s\S]*or public\.is_platform_admin\(\)/i,
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can insert local delivery neighborhoods"[\s\S]*with check \(public\.is_platform_admin\(\)\)/i,
  );
  assert.match(
    migrationSource,
    /grant select on public\.local_delivery_neighborhoods to anon, authenticated;/i,
  );
});

test("local delivery admin catalog: la capa de lectura e import usa el mismo contrato de columnas", () => {
  assert.match(
    localDeliverySource,
    /select\("id, city_key, city_name, name, latitude, longitude, is_active"\)/,
  );
  assert.match(
    localDeliverySource,
    /\.insert\(\{\s*id: crypto\.randomUUID\(\),\s*city_key: city\.cityKey,\s*city_name: city\.cityName,\s*name: neighborhood\.name,\s*latitude: neighborhood\.latitude,\s*longitude: neighborhood\.longitude,\s*is_active: neighborhood\.isActive,\s*\}\)/s,
  );
  assert.match(
    localDeliverySource,
    /\.eq\("id", existingNeighborhood\.neighborhoodId\)/,
  );
  assert.match(
    apiSource,
    /getLocalDeliveryAdminCatalogSnapshot\(\)/,
  );
});
