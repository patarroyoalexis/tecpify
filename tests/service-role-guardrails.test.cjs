/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const SERVICE_ROLE_ENV_PATTERN = /\bSUPABASE_SERVICE_ROLE_KEY\b/g;
const SERVICE_ROLE_IMPORT_PATTERNS = [
  /@\/lib\/supabase\/service-role/g,
  /@\/lib\/supabase\/internal\/service-role-client/g,
  /\bcreateInternalServiceRoleSupabaseClient\b/g,
  /\bcreateServerSupabaseAdminClient\b/g,
];
const OPERATIONAL_MODULES_TO_LOAD = [
  "lib/supabase/server.ts",
  "data/businesses.ts",
  "lib/data/products.ts",
  "lib/data/orders-server.ts",
  "lib/orders/state-rules.ts",
  "lib/orders/history-rules.ts",
  "lib/auth/server.ts",
  "lib/auth/business-access.ts",
  "lib/data/business-ownership-remediation.ts",
  "app/api/businesses/route.ts",
  "app/api/businesses/legacy-remediation/request/route.ts",
  "app/api/businesses/legacy-remediation/claim/route.ts",
  "app/api/orders/route.ts",
  "app/api/orders/private/route.ts",
  "app/api/orders/[orderId]/route.ts",
];
const ALLOWED_SERVICE_ROLE_ENV_REFERENCES = new Set([
  ".env.example",
  "AGENTS.md",
  "README.md",
  "lib/env.ts",
  "lib/supabase/service-role.ts",
  "lib/supabase/internal/service-role-client.ts",
  "tests/documentation-guardrails.test.cjs",
  "tests/env-guardrails.test.cjs",
  "tests/service-role-guardrails.test.cjs",
]);
const SERVICE_ROLE_MODULE_FILES = new Set([
  "lib/supabase/service-role.ts",
  "lib/supabase/internal/service-role-client.ts",
  "tests/service-role-guardrails.test.cjs",
]);

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function getAllRepoFiles(rootDirectory) {
  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === ".next" ||
      entry.name === "node_modules" ||
      entry.name === ".env.local"
    ) {
      continue;
    }

    const absolutePath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllRepoFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

test("service role: el inventario activo sigue vacio y los restos permanecen aislados", () => {
  const { SERVICE_ROLE_USAGE_INVENTORY, getActiveServiceRoleUsageIds } = loadTsModule(
    "lib/supabase/service-role.ts",
  );

  assert.ok(
    SERVICE_ROLE_USAGE_INVENTORY.length > 0,
    "El inventario historico de service role no debe desaparecer; documenta los reemplazos hechos.",
  );
  assert.deepEqual(
    getActiveServiceRoleUsageIds(),
    [],
    "El MVP no debe tener usos activos de service role en runtime normal.",
  );
});

test("service role: SUPABASE_SERVICE_ROLE_KEY solo aparece en archivos permitidos", () => {
  const offendingFiles = [];

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));
    const source = fs.readFileSync(absolutePath, "utf8");
    SERVICE_ROLE_ENV_PATTERN.lastIndex = 0;

    if (!SERVICE_ROLE_ENV_PATTERN.test(source)) {
      continue;
    }

    if (!ALLOWED_SERVICE_ROLE_ENV_REFERENCES.has(relativePath)) {
      offendingFiles.push(relativePath);
    }
  }

  assert.deepEqual(
    offendingFiles,
    [],
    `SUPABASE_SERVICE_ROLE_KEY aparecio fuera del inventario permitido: ${offendingFiles.join(", ")}`,
  );
});

test("service role: ningun modulo operativo importa helpers privilegiados", () => {
  const offenders = [];

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));

    if (SERVICE_ROLE_MODULE_FILES.has(relativePath)) {
      continue;
    }

    if (!/\.(?:[cm]?[jt]sx?|sql)$/i.test(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    for (const pattern of SERVICE_ROLE_IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
    }
    const matchedPatterns = SERVICE_ROLE_IMPORT_PATTERNS.filter((pattern) => pattern.test(source));

    for (const pattern of matchedPatterns) {
      pattern.lastIndex = 0;
    }

    if (matchedPatterns.length > 0) {
      offenders.push(
        `${relativePath}: ${matchedPatterns.map((pattern) => pattern.source).join(", ")}`,
      );
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Se detectaron imports o simbolos de service role fuera del area aislada:\n${offenders.join("\n")}`,
  );
});

test("service role: los modulos operativos cargan sin SUPABASE_SERVICE_ROLE_KEY", () => {
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    for (const relativePath of OPERATIONAL_MODULES_TO_LOAD) {
      assert.doesNotThrow(
        () => loadTsModule(relativePath),
        `${relativePath} no debe depender de SUPABASE_SERVICE_ROLE_KEY para cargar el flujo normal.`,
      );
    }
  } finally {
    if (previousServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    }
  }
});
