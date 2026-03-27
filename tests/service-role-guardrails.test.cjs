/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const SERVICE_ROLE_ENV_PATTERN = /\bSUPABASE_SERVICE_ROLE_KEY\b/g;
const SERVICE_ROLE_RUNTIME_SYMBOL_PATTERN = /\bsupabaseServiceRoleKey\b/g;
const SERVICE_ROLE_IMPORT_PATTERNS = [
  /@\/lib\/supabase\/service-role/g,
  /@\/lib\/supabase\/internal\/service-role-client/g,
  /\bcreateInternalServiceRoleSupabaseClient\b/g,
  /\bcreateServerSupabaseAdminClient\b/g,
];
const LOCAL_IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;
const RESOLVABLE_SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const OPERATIONAL_MODULES_TO_LOAD = [
  "lib/env.ts",
  "lib/supabase/client.ts",
  "lib/supabase/server.ts",
  "data/businesses.ts",
  "lib/data/products.ts",
  "lib/data/orders-server.ts",
  "lib/orders/state-rules.ts",
  "lib/orders/history-rules.ts",
  "lib/auth/server.ts",
  "lib/auth/business-access.ts",
  "app/api/businesses/route.ts",
  "app/api/orders/route.ts",
  "app/api/orders/private/route.ts",
  "app/api/orders/[orderId]/route.ts",
  "middleware.ts",
];
const PRIVILEGED_MODULES = new Set([
  "lib/supabase/service-role.ts",
  "lib/supabase/internal/service-role-client.ts",
]);
const OPERATIONAL_IMPORT_ROOT_PREFIXES = ["app/", "data/", "lib/auth/", "lib/data/"];
const OPERATIONAL_IMPORT_ROOT_FILES = new Set(["lib/supabase/server.ts", "middleware.ts"]);
const ALLOWED_SERVICE_ROLE_ENV_REFERENCES = new Set([
  ".env.example",
  "AGENTS.md",
  "README.md",
  "lib/supabase/service-role.ts",
  "lib/supabase/internal/service-role-client.ts",
  "tests/documentation-guardrails.test.cjs",
  "tests/e2e/support/supabase-admin-bootstrap.ts",
  "tests/env-guardrails.test.cjs",
  "tests/service-role-guardrails.test.cjs",
]);
const NON_OPERATIONAL_SERVICE_ROLE_REFERENCE_FILES = new Set([
  "eslint.config.mjs",
  "lib/supabase/service-role.ts",
  "lib/supabase/internal/service-role-client.ts",
  "tests/service-role-guardrails.test.cjs",
]);
const ALLOWED_SERVICE_ROLE_RUNTIME_SYMBOL_REFERENCES = new Set([
  "tests/env-guardrails.test.cjs",
  "tests/service-role-guardrails.test.cjs",
]);
const ALLOWED_PRIVILEGED_DIRECT_IMPORTERS = new Map([
  ["lib/supabase/service-role.ts", new Set(["lib/supabase/internal/service-role-client.ts"])],
  ["lib/supabase/internal/service-role-client.ts", new Set()],
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
      entry.name === ".tmp" ||
      entry.name === "node_modules" ||
      entry.name === "coverage" ||
      entry.name === "dist" ||
      entry.name === "build" ||
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

function isSourceFile(relativePath) {
  return SOURCE_FILE_PATTERN.test(relativePath);
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function fileExists(absolutePath) {
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
}

function resolveLocalImportSpecifier(fromRelativePath, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) {
    return null;
  }

  const unresolvedAbsolutePath = specifier.startsWith("@/")
    ? path.join(repoRoot, specifier.slice(2))
    : path.resolve(repoRoot, path.dirname(fromRelativePath), specifier);

  const candidatePaths = [];

  if (path.extname(unresolvedAbsolutePath)) {
    candidatePaths.push(unresolvedAbsolutePath);
  } else {
    candidatePaths.push(unresolvedAbsolutePath);

    for (const extension of RESOLVABLE_SOURCE_EXTENSIONS) {
      candidatePaths.push(`${unresolvedAbsolutePath}${extension}`);
    }

    for (const extension of RESOLVABLE_SOURCE_EXTENSIONS) {
      candidatePaths.push(path.join(unresolvedAbsolutePath, `index${extension}`));
    }
  }

  for (const candidatePath of candidatePaths) {
    if (!fileExists(candidatePath)) {
      continue;
    }

    const resolvedRelativePath = normalizeRelativePath(path.relative(repoRoot, candidatePath));
    return isSourceFile(resolvedRelativePath) ? resolvedRelativePath : null;
  }

  return null;
}

function extractLocalImports(relativePath) {
  const source = readRepoFile(relativePath);
  const resolvedImports = new Set();

  for (const match of source.matchAll(LOCAL_IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];

    if (!specifier) {
      continue;
    }

    const resolvedRelativePath = resolveLocalImportSpecifier(relativePath, specifier);

    if (resolvedRelativePath) {
      resolvedImports.add(resolvedRelativePath);
    }
  }

  return [...resolvedImports].sort();
}

function buildLocalImportGraph() {
  const graph = new Map();

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));

    if (!isSourceFile(relativePath)) {
      continue;
    }

    graph.set(relativePath, extractLocalImports(relativePath));
  }

  return graph;
}

function buildReverseImportGraph(importGraph) {
  const reverseGraph = new Map();

  for (const [importer, importedModules] of importGraph.entries()) {
    for (const importedModule of importedModules) {
      const currentImporters = reverseGraph.get(importedModule) ?? [];
      currentImporters.push(importer);
      reverseGraph.set(importedModule, currentImporters);
    }
  }

  return reverseGraph;
}

function getOperationalImportRoots(importGraph) {
  return [...importGraph.keys()]
    .filter(
      (relativePath) =>
        OPERATIONAL_IMPORT_ROOT_FILES.has(relativePath) ||
        OPERATIONAL_IMPORT_ROOT_PREFIXES.some((prefix) => relativePath.startsWith(prefix)),
    )
    .filter((relativePath) => !relativePath.startsWith("tests/"))
    .filter((relativePath) => !PRIVILEGED_MODULES.has(relativePath))
    .sort();
}

function findReachabilityTrace(importGraph, startPath) {
  const queue = [[startPath]];
  const visited = new Set([startPath]);

  while (queue.length > 0) {
    const trace = queue.shift();
    const currentPath = trace.at(-1);

    if (currentPath !== startPath && PRIVILEGED_MODULES.has(currentPath)) {
      return trace;
    }

    const neighbors = importGraph.get(currentPath) ?? [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }

      visited.add(neighbor);
      queue.push([...trace, neighbor]);
    }
  }

  return null;
}

function isAllowedPrivilegedDirectImporter(importerPath, privilegedModulePath) {
  if (importerPath.startsWith("tests/")) {
    return true;
  }

  return ALLOWED_PRIVILEGED_DIRECT_IMPORTERS.get(privilegedModulePath)?.has(importerPath) ?? false;
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

test("service role: supabaseServiceRoleKey no reaparece fuera de los guardrails", () => {
  const offendingFiles = [];

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));
    const source = fs.readFileSync(absolutePath, "utf8");
    SERVICE_ROLE_RUNTIME_SYMBOL_PATTERN.lastIndex = 0;

    if (!SERVICE_ROLE_RUNTIME_SYMBOL_PATTERN.test(source)) {
      continue;
    }

    if (!ALLOWED_SERVICE_ROLE_RUNTIME_SYMBOL_REFERENCES.has(relativePath)) {
      offendingFiles.push(relativePath);
    }
  }

  assert.deepEqual(
    offendingFiles,
    [],
    `supabaseServiceRoleKey reaparecio fuera de los guardrails permitidos: ${offendingFiles.join(", ")}`,
  );
});

test("service role: ningun modulo operativo importa helpers privilegiados por texto directo", () => {
  const offenders = [];

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));

    if (!isSourceFile(relativePath)) {
      continue;
    }

    if (
      relativePath.startsWith("tests/") ||
      NON_OPERATIONAL_SERVICE_ROLE_REFERENCE_FILES.has(relativePath)
    ) {
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

test("service role: no existen consumidores directos fuera de tests e infraestructura privilegiada", () => {
  const importGraph = buildLocalImportGraph();
  const reverseImportGraph = buildReverseImportGraph(importGraph);
  const offenders = [];

  for (const privilegedModulePath of PRIVILEGED_MODULES) {
    const importers = [...(reverseImportGraph.get(privilegedModulePath) ?? [])].sort();
    const disallowedImporters = importers.filter(
      (importerPath) => !isAllowedPrivilegedDirectImporter(importerPath, privilegedModulePath),
    );

    if (disallowedImporters.length > 0) {
      offenders.push(`${privilegedModulePath}: ${disallowedImporters.join(", ")}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Se detectaron consumidores directos del borde privilegiado fuera del area permitida:\n${offenders.join("\n")}`,
  );
});

test("service role: el flujo operativo no alcanza modulos privilegiados ni por reexports", () => {
  const importGraph = buildLocalImportGraph();
  const offenders = [];

  for (const operationalRootPath of getOperationalImportRoots(importGraph)) {
    const trace = findReachabilityTrace(importGraph, operationalRootPath);

    if (trace) {
      offenders.push(trace.join(" -> "));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Se detectaron caminos operativos hacia modulos privilegiados:\n${offenders.join("\n")}`,
  );
});

test("service role: lib/supabase/server.ts permanece separado del borde privilegiado", () => {
  const serverSource = readRepoFile("lib/supabase/server.ts");

  assert.doesNotMatch(
    serverSource,
    /\bSUPABASE_SERVICE_ROLE_KEY\b|\bsupabaseServiceRoleKey\b|createInternalServiceRoleSupabaseClient|createServerSupabaseAdminClient|service-role/,
    "lib/supabase/server.ts no puede remezclar cliente SSR/publico con helpers privilegiados.",
  );
  assert.doesNotMatch(
    serverSource,
    /process\.env\./,
    "lib/supabase/server.ts no debe leer process.env directamente ni reintroducir la service role.",
  );
});

test("service role: eslint bloquea imports privilegiados desde el flujo operativo", () => {
  const eslintConfigSource = readRepoFile("eslint.config.mjs");

  assert.match(
    eslintConfigSource,
    /no-restricted-imports/,
    "ESLint debe bloquear imports privilegiados en los modulos operativos del MVP.",
  );
  assert.match(
    eslintConfigSource,
    /@\/lib\/supabase\/service-role/,
    "ESLint debe vetar imports del inventario de service role desde rutas operativas.",
  );
  assert.match(
    eslintConfigSource,
    /@\/lib\/supabase\/internal\/service-role-client/,
    "ESLint debe vetar imports del cliente privilegiado internal-only desde rutas operativas.",
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
