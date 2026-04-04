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
    "20260404002_add_local_delivery_fields_to_businesses.sql",
  ),
  "utf8",
);
const localDeliverySource = fs.readFileSync(
  path.join(repoRoot, "lib", "data", "local-delivery.ts"),
  "utf8",
);
const businessSettingsSource = fs.readFileSync(
  path.join(repoRoot, "components", "dashboard", "business-settings-list.tsx"),
  "utf8",
);

test("local delivery businesses contract: la migracion crea exactamente los campos local_delivery_* que lee el runtime", () => {
  assert.match(
    migrationSource,
    /add column if not exists local_delivery_enabled boolean not null default false,/i,
  );
  assert.match(
    migrationSource,
    /add column if not exists local_delivery_origin_neighborhood_id uuid,/i,
  );
  assert.match(
    migrationSource,
    /add column if not exists local_delivery_max_distance_km numeric,/i,
  );
  assert.match(
    migrationSource,
    /add column if not exists local_delivery_pricing_bands jsonb not null default '\[\]'::jsonb/i,
  );
  assert.match(
    migrationSource,
    /foreign key \(local_delivery_origin_neighborhood_id\)[\s\S]*references public\.local_delivery_neighborhoods\(id\)[\s\S]*on delete set null;/i,
  );
  assert.match(
    migrationSource,
    /check \(local_delivery_max_distance_km is null or local_delivery_max_distance_km >= 0\)/i,
  );
  assert.match(
    migrationSource,
    /check \(jsonb_typeof\(local_delivery_pricing_bands\) = 'array'\)/i,
  );
});

test("local delivery businesses contract: la capa de lectura sigue consultando el contrato SQL exacto", () => {
  assert.ok(
    localDeliverySource.includes(
      '    .select(\n      "id, local_delivery_enabled, local_delivery_origin_neighborhood_id, local_delivery_max_distance_km, local_delivery_pricing_bands",\n    )',
    ),
  );
  assert.ok(
    businessSettingsSource.includes(
      'business.localDeliverySettings.schemaStatus === "ready" &&\n                catalogSchemaStatus === "ready"',
    ),
  );
});
