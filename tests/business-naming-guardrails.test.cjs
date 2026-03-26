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
    id: "biz-1",
    slug: "mi-tienda",
    name: "Mi tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    updatedAt: "2026-03-25T21:00:00.000Z",
    createdByUserId: "user-owner",
    ...overrides,
  };
}

function createProductRow(overrides = {}) {
  return {
    id: "prod-1",
    business_id: "biz-1",
    name: "Hamburguesa",
    description: "Doble carne",
    price: 15000,
    is_available: true,
    is_featured: false,
    sort_order: 1,
    created_at: "2026-03-25T21:00:00.000Z",
    updated_at: "2026-03-25T21:00:00.000Z",
    ...overrides,
  };
}

function mapProductToBusinessProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: product.price,
    isAvailable: product.is_available,
    isFeatured: product.is_featured,
    sortOrder: product.sort_order ?? 0,
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

  const result = await getBusinessByIdWithProducts("biz-1");

  assert.equal(receivedBusinessId, "biz-1");
  assert.equal(productsLookupBusinessId, "biz-1");
  assert.equal(slugLookupWasCalled, false);
  assert.equal(result.status, "ok");
  assert.equal(result.business.databaseId, "biz-1");
  assert.equal(result.business.slug, "mi-tienda");
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
  assert.equal(productsLookupBusinessId, "biz-1");
  assert.equal(idLookupWasCalled, false);
  assert.equal(result.status, "ok");
  assert.equal(result.business.databaseId, "biz-1");
  assert.equal(result.business.slug, "mi-tienda");
});

test("naming: guardrail bloquea reintroducir helper byId falso o naming legado en codigo publico", () => {
  const businessesSource = fs.readFileSync(path.join(repoRoot, "data", "businesses.ts"), "utf8");
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
  assert.deepEqual(
    offendingLegacyNames,
    [],
    `No debe reaparecer negocioId en codigo o documentacion publica: ${offendingLegacyNames.join(", ")}`,
  );
});
