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

function getLatestMigrationSourceByPattern(pattern) {
  const migrationFilenames = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => pattern.test(fs.readFileSync(path.join(migrationsDir, filename), "utf8")))
    .sort();

  if (migrationFilenames.length === 0) {
    throw new Error(`No se encontro una migracion que coincida con ${pattern}.`);
  }

  return fs.readFileSync(path.join(migrationsDir, migrationFilenames.at(-1)), "utf8");
}

function extractSqlFunctionBlock(source, functionName) {
  const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(
      `create(?:\\s+or\\s+replace)?\\s+function\\s+${escapedFunctionName}\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  );

  return match?.[0] ?? "";
}

const productDeleteMigrationSource = getLatestMigrationSourceByPattern(
  /create(?:\s+or\s+replace)?\s+function\s+public\.products_block_delete_when_referenced_by_orders/i,
);
const orderProductsIncludeProductSource = extractSqlFunctionBlock(
  productDeleteMigrationSource,
  "public.order_products_include_product",
);
const productDeleteGuardFunctionSource = extractSqlFunctionBlock(
  productDeleteMigrationSource,
  "public.products_block_delete_when_referenced_by_orders",
);
const productsDataSource = readFile("lib/data/products.ts");
const productByIdApiSource = readFile("app/api/products/[productId]/route.ts");

test("db guardrails: Supabase veta el delete directo de productos usados historicamente", () => {
  assert.match(
    productDeleteMigrationSource,
    /create or replace function public\.order_products_include_product/i,
    "La DB debe centralizar una deteccion reutilizable del productId dentro del snapshot historico.",
  );
  assert.match(
    orderProductsIncludeProductSource,
    /productId/,
    "La DB debe inspeccionar el contrato canónico productId dentro de orders.products.",
  );
  assert.match(
    orderProductsIncludeProductSource,
    /product_id/,
    "La DB debe seguir protegiendo historicos legacy que hayan persistido product_id.",
  );
  assert.match(
    productDeleteMigrationSource,
    /create or replace function public\.count_orders_that_reference_product/i,
    "La DB debe poder contar referencias historicas reales antes del delete.",
  );
  assert.match(
    productDeleteGuardFunctionSource,
    /No puedes borrar/,
    "El trigger de DB debe emitir el error canonico de borrado bloqueado.",
  );
  assert.match(
    productDeleteGuardFunctionSource,
    /historico.*persistido/i,
    "El error canónico debe dejar claro que la proteccion vive sobre pedidos historicos persistidos.",
  );
  assert.match(
    productDeleteMigrationSource,
    /create trigger products_block_delete_when_referenced_by_orders/i,
    "El veto debe quedar cableado en un trigger before delete sobre public.products.",
  );
});

test("regresion: runtime intenta el delete real y traduce el error canonico de DB", () => {
  assert.match(
    productsDataSource,
    /\.from\("products"\)\s*\.delete\(\)/,
    "La capa de datos debe intentar el delete real sobre products para que la DB sea la autoridad final.",
  );
  assert.doesNotMatch(
    productsDataSource,
    /getProductUsageValidation|readPersistedOrderProductsFromDatabase|product usage lookup/i,
    "El runtime ya no debe depender de un precheck paralelo sobre orders para decidir si borra.",
  );
  assert.match(
    productsDataSource,
    /error\.message\.startsWith\("No puedes borrar"\)/,
    "La capa de datos debe reconocer y propagar el error canonico emitido por Supabase.",
  );
  assert.match(
    productByIdApiSource,
    /message\.startsWith\("No puedes borrar"\)/,
    "La ruta DELETE debe responder de forma consistente cuando la DB veta el borrado.",
  );
});
