/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const envModulePath = path.join(repoRoot, "lib", "env.ts");

const DOC_PREFIX_PATTERN = /\b(?:NEXT_PUBLIC|SUPABASE)_[A-Z0-9_]+\b/g;
const PROCESS_ENV_PATTERN = /process\.env\.([A-Z0-9_]+)/g;

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

function getCanonicalEnvUsage() {
  const envSource = fs.readFileSync(envModulePath, "utf8");
  const usedNames = extractEnvNames(envSource, PROCESS_ENV_PATTERN);
  const canonicalNames = new Set(
    [...usedNames].filter((name) => !ENV_USAGE_EXCEPTIONS.has(name)),
  );

  return {
    usedNames,
    canonicalNames,
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

test("entorno: AGENTS, README y .env.example se mantienen congruentes con lib/env.ts", () => {
  const { canonicalNames } = getCanonicalEnvUsage();
  const documentedInAgents = getDocumentedEnvNames("AGENTS.md");
  const documentedInReadme = getDocumentedEnvNames("README.md");
  const documentedInEnvExample = getDocumentedEnvNames(".env.example");

  for (const [label, documentedNames] of [
    ["AGENTS.md", documentedInAgents],
    ["README.md", documentedInReadme],
    [".env.example", documentedInEnvExample],
  ]) {
    const missingInDocument = new Set(
      [...canonicalNames].filter((name) => !documentedNames.has(name)),
    );
    const unusedInDocument = new Set(
      [...documentedNames].filter((name) => !canonicalNames.has(name)),
    );

    assert.equal(
      missingInDocument.size,
      0,
      `${label} no documenta variables usadas en lib/env.ts: ${formatSet(missingInDocument)}`,
    );
    assert.equal(
      unusedInDocument.size,
      0,
      `${label} documenta variables que no se usan en lib/env.ts: ${formatSet(unusedInDocument)}`,
    );
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
