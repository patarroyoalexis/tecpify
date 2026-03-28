/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const {
  createGetBusinessByIdWithProducts,
  createGetBusinessBySlugWithProducts,
} = loadTsModule("data/businesses.ts");

function createBusinessRecord(overrides = {}) {
  return {
    businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
    businessSlug: "mi-tienda",
    name: "Mi tienda",
    transferInstructions: null,
    acceptsCash: true,
    acceptsTransfer: true,
    acceptsCard: true,
    allowsFiado: false,
    createdAt: "2026-03-25T21:00:00.000Z",
    updatedAt: "2026-03-25T21:00:00.000Z",
    createdByUserId: "user-owner",
    ...overrides,
  };
}

function createProductRow(overrides = {}) {
  return {
    productId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac002",
    businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
    name: "Hamburguesa",
    description: "Doble carne",
    price: 15000,
    isAvailable: true,
    isFeatured: false,
    sortOrder: 1,
    createdAt: "2026-03-25T21:00:00.000Z",
    updatedAt: "2026-03-25T21:00:00.000Z",
    ...overrides,
  };
}

function mapProductToBusinessProduct(product) {
  return {
    productId: product.productId,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    sortOrder: product.sortOrder ?? 0,
  };
}

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
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

test("naming: los segmentos y params de negocio usan businessSlug y no negocioId ni businessId engañosos", () => {
  const appFiles = getAllRepoFiles(path.join(repoRoot, "app"))
    .map((absolutePath) => normalizeRelativePath(path.relative(repoRoot, absolutePath)));
  const offendingSegments = appFiles.filter((relativePath) => relativePath.includes("[negocioId]"));
  const privatePagesSource = fs.readFileSync(
    path.join(repoRoot, "lib", "page-contracts", "private-business-pages.ts"),
    "utf8",
  );
  const storefrontPageSource = fs.readFileSync(
    path.join(repoRoot, "lib", "page-contracts", "storefront-order-page.ts"),
    "utf8",
  );

  assert.deepEqual(
    offendingSegments,
    [],
    `No deben existir segmentos dinamicos engañosos de negocio: ${offendingSegments.join(", ")}`,
  );
  assert.doesNotMatch(
    privatePagesSource,
    /\bnegocioId\b|params:\s*Promise<\{\s*businessId:\s*string\s*\}>/,
    "Los page contracts privados deben recibir businessSlug y no negocioId/businessId engañosos.",
  );
  assert.doesNotMatch(
    storefrontPageSource,
    /\bnegocioId\b|params:\s*Promise<\{\s*businessId:\s*string\s*\}>/,
    "El page contract publico debe recibir businessSlug y no negocioId/businessId engañosos.",
  );
});

test("naming: helper verdaderamente byId consulta por businessId real de BD", async () => {
  let receivedBusinessId = null;
  let slugLookupWasCalled = false;
  let productsLookupBusinessId = null;
  const getBusinessByIdWithProducts = createGetBusinessByIdWithProducts({
    getBusinessByIdFromDatabase: async (businessId) => {
      receivedBusinessId = businessId;
      return createBusinessRecord();
    },
    getBusinessBySlugFromDatabase: async () => {
      slugLookupWasCalled = true;
      return null;
    },
    getProductsByBusinessId: async (businessId) => {
      productsLookupBusinessId = businessId;
      return [createProductRow()];
    },
    mapProductToBusinessProduct,
    debugLog: () => {},
  });

  const result = await getBusinessByIdWithProducts("0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");

  assert.equal(receivedBusinessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.equal(productsLookupBusinessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.equal(slugLookupWasCalled, false);
  assert.equal(result.status, "ok");
  assert.equal(result.business.businessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.equal(result.business.businessSlug, "mi-tienda");
});

test("naming: helper por slug consulta por businessSlug real de URL", async () => {
  let receivedBusinessSlug = null;
  let idLookupWasCalled = false;
  let productsLookupBusinessId = null;
  const getBusinessBySlugWithProducts = createGetBusinessBySlugWithProducts({
    getBusinessBySlugFromDatabase: async (businessSlug) => {
      receivedBusinessSlug = businessSlug;
      return createBusinessRecord();
    },
    getBusinessByIdFromDatabase: async () => {
      idLookupWasCalled = true;
      return null;
    },
    getProductsByBusinessId: async (businessId) => {
      productsLookupBusinessId = businessId;
      return [createProductRow()];
    },
    mapProductToBusinessProduct,
    debugLog: () => {},
  });

  const result = await getBusinessBySlugWithProducts("mi-tienda");

  assert.equal(receivedBusinessSlug, "mi-tienda");
  assert.equal(productsLookupBusinessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.equal(idLookupWasCalled, false);
  assert.equal(result.status, "ok");
  assert.equal(result.business.businessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.equal(result.business.businessSlug, "mi-tienda");
});

test("naming: guardrail bloquea reintroducir helper byId falso o naming legado en codigo publico", () => {
  const businessesSource = fs.readFileSync(path.join(repoRoot, "data", "businesses.ts"), "utf8");
  const createBusinessPanelSource = fs.readFileSync(
    path.join(repoRoot, "components", "home", "create-business-panel.tsx"),
    "utf8",
  );
  const workspaceHeaderSource = fs.readFileSync(
    path.join(repoRoot, "components", "dashboard", "workspace-header.tsx"),
    "utf8",
  );
  const publicSources = getAllRepoFiles(repoRoot)
    .map((absolutePath) => normalizeRelativePath(path.relative(repoRoot, absolutePath)))
    .filter((relativePath) =>
      /^(?:app|components|data|lib|README\.md|AGENTS\.md)/.test(relativePath),
    )
    .filter((relativePath) => !relativePath.startsWith("tests/"));
  const offendingLegacyNames = publicSources.filter((relativePath) =>
    /\bnegocioId\b/.test(fs.readFileSync(path.join(repoRoot, relativePath), "utf8")),
  );

  assert.match(
    businessesSource,
    /createGetBusinessByIdWithProducts/,
    "El repo debe exponer un helper byId real para businessId de BD.",
  );
  assert.match(
    businessesSource,
    /getBusinessByIdFromDatabase/,
    "El helper byId debe pasar por una consulta real por id.",
  );
  assert.doesNotMatch(
    businessesSource,
    /return\s+getBusinessBySlugWithProducts\(businessId\)/,
    "Un helper byId no puede delegar encubiertamente al lookup por slug.",
  );
  assert.doesNotMatch(
    createBusinessPanelSource,
    /\bconst \[slug,|\berrors\.slug\b|validateForm\(name,\s*slug\)|`\/dashboard\/\[slug\]`/,
    "La UI no debe volver a usar slug generico cuando el contrato real es businessSlug.",
  );
  assert.match(
    createBusinessPanelSource,
    /\bbusinessSlug\b/,
    "La UI de alta debe nombrar explicitamente businessSlug en su contrato local.",
  );
  assert.doesNotMatch(
    workspaceHeaderSource,
    /getHref:\s*\(slug:\s*string\)/,
    "La navegacion privada no debe volver a usar slug generico en helpers locales.",
  );
  assert.deepEqual(
    offendingLegacyNames,
    [],
    `No debe reaparecer negocioId en codigo o documentacion publica: ${offendingLegacyNames.join(", ")}`,
  );
});

test("naming: ownership usa solo created_by_user_id en SQL y createdByUserId en TypeScript", () => {
  const forbiddenOwnershipAliases = [
    ["owner", "_id"].join(""),
    ["owner", "_user", "_id"].join(""),
    ["owner", "UserId"].join(""),
  ];
  const relevantSources = getAllRepoFiles(repoRoot)
    .map((absolutePath) => normalizeRelativePath(path.relative(repoRoot, absolutePath)))
    .filter((relativePath) =>
      /^(?:app|components|data|lib|supabase\/migrations|tests|types|README\.md|AGENTS\.md)/.test(
        relativePath,
      ),
    );
  const offendingAliases = relevantSources.filter((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

    return forbiddenOwnershipAliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(source));
  });
  const businessAccessSource = fs.readFileSync(
    path.join(repoRoot, "lib", "auth", "business-access.ts"),
    "utf8",
  );
  const legacyBusinessAccessSource = fs.readFileSync(
    path.join(repoRoot, "lib", "auth", "legacy-business-access.ts"),
    "utf8",
  );

  assert.deepEqual(
    offendingAliases,
    [],
    `No deben reaparecer aliases falsos de ownership: ${offendingAliases.join(", ")}`,
  );
  assert.match(
    businessAccessSource,
    /\bcreatedByUserId\b/,
    "La capa de acceso debe usar createdByUserId como contrato TypeScript canonico.",
  );
  assert.match(
    legacyBusinessAccessSource,
    /\bcreatedByUserId\b/,
    "La estrategia legacy debe usar createdByUserId como contrato TypeScript canonico.",
  );
});
