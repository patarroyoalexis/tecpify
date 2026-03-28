/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

function getLatestStorefrontLookupMigration() {
  const migrationFilenames = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => {
      const source = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      return /create(?:\s+or\s+replace)?\s+function\s+public\.get_storefront_business_by_slug/i.test(
        source,
      );
    })
    .sort();

  if (migrationFilenames.length === 0) {
    throw new Error(
      "No se encontro ninguna migracion que defina public.get_storefront_business_by_slug.",
    );
  }

  const latestFilename = migrationFilenames.at(-1);

  return {
    filename: latestFilename,
    source: fs.readFileSync(path.join(migrationsDir, latestFilename), "utf8"),
  };
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

test("storefront business lookup: la ultima migracion mantiene el owner en el contrato publico controlado", () => {
  const latestMigration = getLatestStorefrontLookupMigration();
  const functionSource = extractSqlFunctionBlock(
    latestMigration.source,
    "public.get_storefront_business_by_slug",
  );

  assert.match(
    functionSource,
    /returns table\s*\([\s\S]*created_by_user_id\s+uuid[\s\S]*\)/i,
    `La ultima definicion de get_storefront_business_by_slug debe exponer created_by_user_id. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.match(
    functionSource,
    /select[\s\S]*businesses\.created_by_user_id/i,
    `La ultima definicion de get_storefront_business_by_slug debe seleccionar created_by_user_id. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.match(
    functionSource,
    /returns table\s*\([\s\S]*accepts_cash\s+boolean[\s\S]*accepts_transfer\s+boolean[\s\S]*accepts_card\s+boolean[\s\S]*\)/i,
    `La ultima definicion de get_storefront_business_by_slug debe exponer los flags publicos de pago. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.match(
    functionSource,
    /select[\s\S]*businesses\.transfer_instructions[\s\S]*businesses\.accepts_cash[\s\S]*businesses\.accepts_transfer[\s\S]*businesses\.accepts_card/i,
    `La ultima definicion de get_storefront_business_by_slug debe seleccionar transfer_instructions y los flags publicos. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.doesNotMatch(
    functionSource,
    /allows_fiado/i,
    `La ultima definicion publica de get_storefront_business_by_slug no debe exponer allows_fiado. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.match(
    latestMigration.source,
    /grant execute on function public\.get_storefront_business_by_slug\(text\) to anon;/i,
    `La ultima definicion de get_storefront_business_by_slug debe preservar el acceso controlado para anon. Revision requerida en ${latestMigration.filename}.`,
  );
  assert.match(
    latestMigration.source,
    /grant execute on function public\.get_storefront_business_by_slug\(text\) to authenticated;/i,
    `La ultima definicion de get_storefront_business_by_slug debe preservar el acceso controlado para authenticated. Revision requerida en ${latestMigration.filename}.`,
  );
});
