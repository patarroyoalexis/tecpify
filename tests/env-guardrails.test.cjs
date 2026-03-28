/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const envModulePath = path.join(repoRoot, "lib", "env.ts");
const privilegedEnvModulePath = path.join(
  repoRoot,
  "lib",
  "supabase",
  "internal",
  "service-role-client.ts",
);

const DOC_PREFIX_PATTERN = /\b((?:NEXT_PUBLIC|SUPABASE|PLAYWRIGHT)_[A-Z0-9_]+|CI)\b/g;
const PROCESS_ENV_PATTERN = /process\.env\.([A-Z0-9_]+)/g;
const ENV_ACCESSOR_PATTERN = /(?:readOptionalEnv|readRequiredEnv)\(\s*"([A-Z0-9_]+)"/g;

const ENV_USAGE_EXCEPTIONS = new Map([
  [
    "NODE_ENV",
    "Variable base del runtime de Node/Next; se permite en lib/env.ts sin exigirla en .env.example.",
  ],
]);

const PROCESS_ENV_READ_EXCEPTIONS = new Map([
  [
    normalizeRelativePath(path.join("tests", "helpers", "test-runtime.cjs")),
    "Bootstrap de pruebas que inyecta entorno controlado para cargar modulos TypeScript en Node test.",
  ],
  [
    normalizeRelativePath(path.join("lib", "supabase", "internal", "service-role-client.ts")),
    "Borde privilegiado aislado: es el unico helper autorizado para leer SUPABASE_SERVICE_ROLE_KEY fuera de lib/env.ts.",
  ],
  [
    normalizeRelativePath(path.join("tests", "service-role-guardrails.test.cjs")),
    "Guardrail que verifica de forma explicita que los modulos operativos siguen cargando sin SUPABASE_SERVICE_ROLE_KEY.",
  ],
  [
    normalizeRelativePath(path.join("tests", "env-guardrails.test.cjs")),
    "Guardrail que muta process.env de forma controlada para verificar la resolucion centralizada del entorno E2E.",
  ],
]);

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractEnvNames(text, pattern) {
  return new Set([...text.matchAll(pattern)].map((match) => match[1] ?? match[0]));
}

function formatSet(values) {
  return [...values].sort().join(", ");
}

function getOperationalEnvUsage() {
  const envSource = fs.readFileSync(envModulePath, "utf8");
  const usedNames = new Set([
    ...extractEnvNames(envSource, PROCESS_ENV_PATTERN),
    ...extractEnvNames(envSource, ENV_ACCESSOR_PATTERN),
  ]);
  const canonicalNames = new Set(
    [...usedNames].filter((name) => !ENV_USAGE_EXCEPTIONS.has(name)),
  );

  return {
    usedNames,
    canonicalNames,
  };
}

function getPrivilegedEnvUsage() {
  const privilegedEnvSource = fs.readFileSync(privilegedEnvModulePath, "utf8");
  const privilegedNames = extractEnvNames(privilegedEnvSource, PROCESS_ENV_PATTERN);

  return {
    privilegedNames,
  };
}

function getDocumentedEnvNames(relativePath) {
  return extractEnvNames(readFile(relativePath), DOC_PREFIX_PATTERN);
}

function getAllRepoFiles(rootDirectory) {
  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".next" || entry.name === "node_modules") {
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

test("entorno: AGENTS, README y .env.example se mantienen congruentes con env operativo y borde privilegiado", () => {
  const { canonicalNames } = getOperationalEnvUsage();
  const { privilegedNames } = getPrivilegedEnvUsage();
  const documentedEnvNames = new Set([...canonicalNames, ...privilegedNames]);
  const documentedInAgents = getDocumentedEnvNames("AGENTS.md");
  const documentedInReadme = getDocumentedEnvNames("README.md");
  const documentedInEnvExample = getDocumentedEnvNames(".env.example");

  for (const [label, documentedNames] of [
    ["AGENTS.md", documentedInAgents],
    ["README.md", documentedInReadme],
    [".env.example", documentedInEnvExample],
  ]) {
    const missingInDocument = new Set(
      [...documentedEnvNames].filter((name) => !documentedNames.has(name)),
    );
    const unusedInDocument = new Set(
      [...documentedNames].filter((name) => !documentedEnvNames.has(name)),
    );

    assert.equal(
      missingInDocument.size,
      0,
      `${label} no documenta variables usadas en el runtime operativo o el borde privilegiado: ${formatSet(missingInDocument)}`,
    );
    assert.equal(
      unusedInDocument.size,
      0,
      `${label} documenta variables que no se usan en el runtime operativo o el borde privilegiado: ${formatSet(unusedInDocument)}`,
    );
  }
});

test("entorno: el env operativo no contiene service role ni getter compartido", () => {
  const envSource = fs.readFileSync(envModulePath, "utf8");
  const envModule = loadTsModule("lib/env.ts");
  const operationalEnv = envModule.getOperationalEnv();

  assert.doesNotMatch(
    envSource,
    /\bSUPABASE_SERVICE_ROLE_KEY\b|\bsupabaseServiceRoleKey\b|\bgetServerEnv\b|\bServerEnv\b/,
    "lib/env.ts no debe leer, tipar ni exportar la service role en el runtime operativo.",
  );
  assert.equal(
    "supabaseServiceRoleKey" in operationalEnv,
    false,
    "El getter operativo no debe exponer supabaseServiceRoleKey.",
  );
  assert.equal(
    "getServerEnv" in envModule,
    false,
    "No debe existir un getter compartido que remezcle el env privilegiado con el runtime normal.",
  );
  assert.doesNotMatch(
    envSource,
    /\bPLAYWRIGHT_OWNER_EMAIL\b|\bPLAYWRIGHT_OWNER_PASSWORD\b|\bPLAYWRIGHT_INTRUDER_EMAIL\b|\bPLAYWRIGHT_INTRUDER_PASSWORD\b/,
    "lib/env.ts no debe volver al contrato fragil de cuatro credenciales humanas para E2E.",
  );
});

test("entorno: Playwright deriva fixtures dedicadas y no humanas desde un unico secreto", () => {
  const previousEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PLAYWRIGHT_E2E_PASSWORD: process.env.PLAYWRIGHT_E2E_PASSWORD,
    PLAYWRIGHT_E2E_NAMESPACE: process.env.PLAYWRIGHT_E2E_NAMESPACE,
  };

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  process.env.PLAYWRIGHT_E2E_PASSWORD = "fixture-password-123";
  delete process.env.PLAYWRIGHT_E2E_NAMESPACE;

  try {
    const envModule = loadTsModule("lib/env.ts");
    const playwrightEnv = envModule.getPlaywrightEnv();

    assert.equal(playwrightEnv.authFixtures.namespace, "fixture-project");
    assert.equal(
      playwrightEnv.authFixtures.owner.email,
      "playwright-owner+fixture-project@example.com",
    );
    assert.equal(
      playwrightEnv.authFixtures.intruder.email,
      "playwright-intruder+fixture-project@example.com",
    );
    assert.equal(playwrightEnv.authFixtures.owner.password, "fixture-password-123");
    assert.equal(playwrightEnv.authFixtures.intruder.password, "fixture-password-123");
    assert.notEqual(
      playwrightEnv.authFixtures.owner.email,
      playwrightEnv.authFixtures.intruder.email,
      "Owner e intruder deben resolverse como identidades distintas aunque compartan el secreto de test.",
    );
  } finally {
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("entorno: no hay lecturas directas de process.env fuera de lib/env.ts salvo excepciones justificadas", () => {
  const offendingReads = [];

  for (const absolutePath of getAllRepoFiles(repoRoot)) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, absolutePath));

    if (relativePath === "lib/env.ts") {
      continue;
    }

    if (PROCESS_ENV_READ_EXCEPTIONS.has(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    const matches = [...source.matchAll(/process\.env\.[A-Z0-9_]+/g)];

    if (matches.length > 0) {
      offendingReads.push(`${relativePath}: ${matches.map((match) => match[0]).join(", ")}`);
    }
  }

  assert.equal(
    offendingReads.length,
    0,
    `Se detectaron lecturas directas de process.env fuera de lib/env.ts:\n${offendingReads.join("\n")}`,
  );
});

test("entorno: las excepciones temporales estan acotadas y siguen existiendo por una razon verificable", () => {
  const envSource = fs.readFileSync(envModulePath, "utf8");

  for (const [exceptionName, reason] of ENV_USAGE_EXCEPTIONS) {
    assert.match(
      envSource,
      new RegExp(`process\\.env\\.${exceptionName}\\b`),
      `La excepcion ${exceptionName} debe existir en lib/env.ts o eliminarse del inventario: ${reason}`,
    );
  }

  for (const [relativePath, reason] of PROCESS_ENV_READ_EXCEPTIONS) {
    const absolutePath = path.join(repoRoot, relativePath);

    assert.equal(
      fs.existsSync(absolutePath),
      true,
      `La excepcion ${relativePath} debe seguir apuntando a un archivo real o eliminarse: ${reason}`,
    );

    const source = fs.readFileSync(absolutePath, "utf8");
    assert.match(
      source,
      /process\.env\.[A-Z0-9_]+/,
      `La excepcion ${relativePath} ya no contiene lecturas directas de process.env y debe retirarse del inventario: ${reason}`,
    );
  }
});
