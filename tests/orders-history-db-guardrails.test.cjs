/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getLatestHistoryMigrationSource() {
  const migrationFilenames = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => {
      const source = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      return /create(?:\s+or\s+replace)?\s+function\s+public\.update_order_with_server_history/i.test(
        source,
      );
    })
    .sort();

  if (migrationFilenames.length === 0) {
    throw new Error("No se encontro una migracion efectiva para update_order_with_server_history.");
  }

  return fs.readFileSync(path.join(migrationsDir, migrationFilenames.at(-1)), "utf8");
}

const historyMigrationSource = getLatestHistoryMigrationSource();
const ordersServerSource = readFile("lib/data/orders-server.ts");
const publicOrdersRouteSource = readFile("app/api/orders/route.ts");
const privateOrdersRouteSource = readFile("app/api/orders/private/route.ts");
const insertPayloadBlock = ordersServerSource.match(
  /const insertPayload = \{(?<block>[\s\S]*?)\n\s*};/,
);
const updatePayloadBlock = ordersServerSource.match(
  /const updatePayload = \{(?<block>[\s\S]*?)\n\s*};/,
);

test("db history guardrails: DB genera el historial inicial y rechaza inserts arbitrarios", () => {
  assert.match(
    historyMigrationSource,
    /create or replace function public\.orders_build_initial_history/i,
    "La base debe centralizar la generacion del historial inicial.",
  );
  assert.match(
    historyMigrationSource,
    /create or replace function public\.orders_enforce_server_generated_history_insert\(\)/i,
    "La base debe tener un trigger before insert para generar history en DB.",
  );
  assert.match(
    historyMigrationSource,
    /history es server-generated y no acepta eventos iniciales enviados por cliente/i,
    "Los inserts directos con history arbitrario deben quedar bloqueados desde DB.",
  );
  assert.match(
    historyMigrationSource,
    /create trigger orders_enforce_server_generated_history_before_insert/i,
    "El trigger before insert debe quedar conectado sobre public.orders.",
  );
});

test("db history guardrails: history queda append-only y solo via funcion controlada", () => {
  assert.match(
    historyMigrationSource,
    /create or replace function public\.orders_block_direct_history_update\(\)/i,
    "La base debe bloquear updates directos que intenten reemplazar history.",
  );
  assert.match(
    historyMigrationSource,
    /Los campos trazables del pedido solo pueden mutarse desde public\.update_order_with_server_history/i,
    "Los cambios trazables no deben poder persistirse por update directo.",
  );
  assert.match(
    historyMigrationSource,
    /create or replace function public\.update_order_with_server_history\(/i,
    "El append-only del historial debe pasar por una funcion controlada.",
  );
  assert.match(
    historyMigrationSource,
    /grant execute on function public\.update_order_with_server_history\(uuid, jsonb\) to authenticated/i,
    "La funcion controlada debe quedar expuesta solo a la frontera autenticada permitida.",
  );
});

test("regresion: rutas y capa de datos no reintroducen snapshots directos de history", () => {
  assert.match(
    publicOrdersRouteSource,
    /sanitizeClientCreateOrderPayload/,
    "La ruta publica debe seguir ignorando history del cliente.",
  );
  assert.match(
    privateOrdersRouteSource,
    /sanitizeClientCreateOrderPayload/,
    "La ruta privada debe seguir ignorando history del cliente.",
  );
  assert.match(
    ordersServerSource,
    /rpc\("update_order_with_server_history"/,
    "La mutacion server-side debe usar la funcion controlada de DB para el historial.",
  );
  assert.doesNotMatch(
    ordersServerSource,
    /appendServerGeneratedOrderHistory/,
    "La capa de datos no debe volver a anexar history desde Next.js.",
  );
  assert.ok(
    insertPayloadBlock?.groups?.block,
    "El insert persistido debe conservar un bloque identificable para guardrails.",
  );
  assert.doesNotMatch(
    insertPayloadBlock.groups.block,
    /\bhistory:/,
    "El insert persistido no debe volver a incluir history como payload directo.",
  );
  assert.ok(
    updatePayloadBlock?.groups?.block,
    "El update persistido debe conservar un bloque identificable para guardrails.",
  );
  assert.doesNotMatch(
    updatePayloadBlock.groups.block,
    /\bhistory:/,
    "El update persistido no debe volver a incluir history como payload directo.",
  );
});

test("db history guardrails: la definicion efectiva incluye trazabilidad de fiado", () => {
  assert.match(
    historyMigrationSource,
    /or previous_order\.is_fiado is distinct from next_order\.is_fiado/i,
    "La definicion efectiva del historial debe tratar fiado como campo trazable.",
  );
  assert.match(
    historyMigrationSource,
    /'isFiado'|'fiadoStatus'|'fiadoObservation'/i,
    "La funcion controlada debe aceptar y registrar los campos internos de fiado.",
  );
  assert.match(
    historyMigrationSource,
    /Estado interno de fiado actualizado/i,
    "La DB debe anexar eventos claros cuando cambia el estado interno de fiado.",
  );
});
