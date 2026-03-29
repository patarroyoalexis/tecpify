/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextResponse } = require("next/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { createProductsRouteHandlers } = loadTsModule("app/api/products/route.ts");
const { createProductByIdRouteHandlers } = loadTsModule(
  "app/api/products/[productId]/route.ts",
);
const {
  createBusinessDashboardPage,
  createOrdersPage,
  createMetricsPage,
} = loadTsModule("lib/page-contracts/private-business-pages.ts");
const { createStorefrontOrderPage } = loadTsModule(
  "lib/page-contracts/storefront-order-page.ts",
);
const { createGetBusinessBySlugWithProducts } = loadTsModule("data/businesses.ts");

const OWNER_ID = "user-owner";
const BUSINESS_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101";
const PRODUCT_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac002";

function createOwnedBusinessContext(overrides = {}) {
  return {
    businessId: BUSINESS_ID,
    businessSlug: "mi-tienda",
    businessName: "Mi tienda",
    transferInstructions: null,
    acceptsCash: true,
    acceptsTransfer: true,
    acceptsCard: true,
    allowsFiado: false,
    createdByUserId: OWNER_ID,
    accessLevel: "owned",
    user: {
      userId: OWNER_ID,
      email: "owner@example.com",
      user: { id: OWNER_ID, email: "owner@example.com" },
    },
    ...overrides,
  };
}

function createProductFixture(overrides = {}) {
  return {
    productId: PRODUCT_ID,
    businessId: BUSINESS_ID,
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

function render(element) {
  return renderToStaticMarkup(element);
}

function createWorkspaceShellComponent(marker) {
  return function WorkspaceShell(props) {
    return React.createElement(
      "section",
      {
        "data-marker": marker,
        "data-business-slug": props.businessSlug,
        "data-title": props.title,
      },
      [
        React.createElement("h1", { key: "title" }, `${props.title}:${props.businessName}`),
        React.createElement(
          "p",
          { key: "email" },
          `operator:${props.operatorEmail ?? "none"}|orders:${props.initialOrders.length}`,
        ),
        props.headerActions
          ? React.createElement("div", { key: "actions" }, props.headerActions)
          : null,
        props.children,
      ],
    );
  };
}

const pageScenarios = [
  {
    name: "dashboard",
    createPage: createBusinessDashboardPage,
    createDependencies(overrides = {}) {
      return {
        requireBusinessContext: async () => createOwnedBusinessContext(),
        getBusinessReadinessSnapshot: () => ({ totalProducts: 1, activeProducts: 1 }),
        getAdminProductsByBusinessId: async () => [createProductFixture()],
        getOrdersByBusinessIdFromDatabase: async () => [],
        BusinessWorkspaceShell: createWorkspaceShellComponent("dashboard-shell"),
        DashboardOverview(props) {
          return React.createElement(
            "div",
            { "data-marker": "dashboard-overview" },
            `${props.businessSlug}:${props.businessName}`,
          );
        },
        ...overrides,
      };
    },
    expectedTitle: "Dashboard",
    expectedMarker: "dashboard-overview",
    routePrefix: "/dashboard/",
  },
  {
    name: "pedidos",
    createPage: createOrdersPage,
    createDependencies(overrides = {}) {
      return {
        requireBusinessContext: async () => createOwnedBusinessContext(),
        getOrdersByBusinessIdFromDatabase: async () => [],
        BusinessWorkspaceShell: createWorkspaceShellComponent("orders-shell"),
        OrdersHeaderActions() {
          return React.createElement("div", { "data-marker": "orders-actions" }, "acciones");
        },
        OrdersWorkspace(props) {
          return React.createElement(
            "div",
            { "data-marker": "orders-workspace" },
            `workspace:${props.businessSlug}`,
          );
        },
        ...overrides,
      };
    },
    expectedTitle: "Pedidos",
    expectedMarker: "orders-workspace",
    routePrefix: "/pedidos/",
  },
  {
    name: "metricas",
    createPage: createMetricsPage,
    createDependencies(overrides = {}) {
      return {
        requireBusinessContext: async () => createOwnedBusinessContext(),
        getOrdersByBusinessIdFromDatabase: async () => [],
        BusinessWorkspaceShell: createWorkspaceShellComponent("metrics-shell"),
        MetricsOverview() {
          return React.createElement("div", { "data-marker": "metrics-overview" }, "metricas");
        },
        ...overrides,
      };
    },
    expectedTitle: "Metricas",
    expectedMarker: "metrics-overview",
    routePrefix: "/metricas/",
  },
];

test("ownership directo: owner puede leer GET /api/products", async () => {
  let receivedBusinessId = null;
  const handlers = createProductsRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    getAdminProductsByBusinessId: async (businessId) => {
      receivedBusinessId = businessId;
      return [createProductFixture()];
    },
    createProductInDatabase: async () => {
      throw new Error("createProductInDatabase no debe usarse");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/products?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedBusinessId, BUSINESS_ID);
  assert.equal(body.products.length, 1);
});

test("ownership directo: GET /api/products exige sesion o contexto valido", async () => {
  let readWasCalled = false;
  const handlers = createProductsRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesión para usar este espacio operativo." },
        { status: 401 },
      ),
    }),
    getAdminProductsByBusinessId: async () => {
      readWasCalled = true;
      return [];
    },
    createProductInDatabase: async () => {
      throw new Error("createProductInDatabase no debe usarse");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/products?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Debes iniciar sesión para usar este espacio operativo.");
  assert.equal(readWasCalled, false);
});

test("ownership directo: GET /api/products rechaza no-owner", async () => {
  let readWasCalled = false;
  const handlers = createProductsRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json({ error: "No tienes acceso a este negocio." }, { status: 403 }),
    }),
    getAdminProductsByBusinessId: async () => {
      readWasCalled = true;
      return [];
    },
    createProductInDatabase: async () => {
      throw new Error("createProductInDatabase no debe usarse");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/products?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "No tienes acceso a este negocio.");
  assert.equal(readWasCalled, false);
});

test("ownership directo: owner puede borrar producto", async () => {
  let deleted = null;
  const handlers = createProductByIdRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    updateProductInDatabase: async () => {
      throw new Error("updateProductInDatabase no debe usarse");
    },
    deleteProductInDatabase: async (productId, businessId) => {
      deleted = { productId, businessId };
      return {
        deletedProduct: createProductFixture(),
        validation: {
          canDelete: true,
          referencedOrdersCount: 0,
          sampleOrders: [],
        },
      };
    },
  });

  const response = await handlers.DELETE(
    new Request(`http://localhost/api/products/${PRODUCT_ID}?businessSlug=mi-tienda`),
    { params: Promise.resolve({ productId: PRODUCT_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(deleted, { productId: PRODUCT_ID, businessId: BUSINESS_ID });
  assert.equal(body.deletedProduct.productId, PRODUCT_ID);
});

test("ownership directo: DELETE /api/products/[productId] exige sesion o contexto valido", async () => {
  let deleteWasCalled = false;
  const handlers = createProductByIdRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesión para usar este espacio operativo." },
        { status: 401 },
      ),
    }),
    updateProductInDatabase: async () => {
      throw new Error("updateProductInDatabase no debe usarse");
    },
    deleteProductInDatabase: async () => {
      deleteWasCalled = true;
      throw new Error("No debe borrar sin sesión valida");
    },
  });

  const response = await handlers.DELETE(
    new Request(`http://localhost/api/products/${PRODUCT_ID}?businessSlug=mi-tienda`),
    { params: Promise.resolve({ productId: PRODUCT_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Debes iniciar sesión para usar este espacio operativo.");
  assert.equal(deleteWasCalled, false);
});

test("ownership directo: DELETE /api/products/[productId] rechaza no-owner y no borra", async () => {
  let deleteWasCalled = false;
  const handlers = createProductByIdRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json({ error: "No tienes acceso a este negocio." }, { status: 403 }),
    }),
    updateProductInDatabase: async () => {
      throw new Error("updateProductInDatabase no debe usarse");
    },
    deleteProductInDatabase: async () => {
      deleteWasCalled = true;
      throw new Error("No debe borrar producto ajeno");
    },
  });

  const response = await handlers.DELETE(
    new Request(`http://localhost/api/products/${PRODUCT_ID}?businessSlug=mi-tienda`),
    { params: Promise.resolve({ productId: PRODUCT_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "No tienes acceso a este negocio.");
  assert.equal(deleteWasCalled, false);
});

for (const scenario of pageScenarios) {
  test(`ownership directo: ${scenario.name} renderiza workspace para owner correcto`, async () => {
    const page = scenario.createPage(scenario.createDependencies());
    const html = render(
      await page({ params: Promise.resolve({ businessSlug: "mi-tienda" }) }),
    );

    assert.match(html, new RegExp(scenario.expectedTitle));
    assert.match(html, /Mi tienda/);
    assert.match(html, new RegExp(scenario.expectedMarker));
  });

  test(`ownership directo: ${scenario.name} propaga redireccion cuando falta sesion`, async () => {
    const redirectError = new Error(`NEXT_REDIRECT:${scenario.routePrefix}mi-tienda`);
    const page = scenario.createPage(
      scenario.createDependencies({
        requireBusinessContext: async () => {
          throw redirectError;
        },
      }),
    );

    await assert.rejects(
      () => page({ params: Promise.resolve({ businessSlug: "mi-tienda" }) }),
      (error) => error === redirectError,
    );
  });

  test(`ownership directo: ${scenario.name} bloquea negocio ajeno o legacy sin acceso`, async () => {
    const page = scenario.createPage(
      scenario.createDependencies({
        requireBusinessContext: async () => null,
      }),
    );
    const html = render(
      await page({ params: Promise.resolve({ businessSlug: "mi-tienda" }) }),
    );

    assert.match(html, /Acceso no autorizado/);
    assert.match(html, /Solo el owner autenticado puede operar este workspace/);
  });
}

test("ownership directo: storefront owner correcto renderiza wizard", async () => {
  const page = createStorefrontOrderPage({
    getBusinessBySlugWithProducts: async () => ({
      status: "ok",
      business: {
        businessSlug: "mi-tienda",
        businessId: BUSINESS_ID,
        name: "Mi tienda",
        tagline: "",
        accent: "",
        availablePaymentMethods: [],
        availableDeliveryTypes: [],
        products: [
          {
            productId: PRODUCT_ID,
            name: "Hamburguesa",
            description: "",
            price: 15000,
            isAvailable: true,
            isFeatured: false,
            sortOrder: 1,
          },
        ],
      },
    }),
    StorefrontOrderWizard({ business }) {
      return React.createElement(
        "div",
        { "data-marker": "storefront-wizard" },
        business.businessSlug,
      );
    },
  });

  const html = render(
    await page({ params: Promise.resolve({ businessSlug: "mi-tienda" }) }),
  );

  assert.match(html, /storefront-wizard/);
  assert.match(html, /mi-tienda/);
});

test("ownership directo: storefront bloquea negocio legacy sin owner y no lo vuelve operativo", async () => {
  const getBusinessBySlugWithProducts = createGetBusinessBySlugWithProducts({
    getBusinessBySlugFromDatabase: async () => ({
      businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac199",
      businessSlug: "legacy-shop",
      name: "Legacy Shop",
      transferInstructions: null,
      acceptsCash: true,
      acceptsTransfer: true,
      acceptsCard: true,
      allowsFiado: false,
      createdAt: "2026-03-25T21:00:00.000Z",
      updatedAt: "2026-03-25T21:00:00.000Z",
      createdByUserId: null,
    }),
    getProductsByBusinessId: async () => [createProductFixture()],
    mapProductToBusinessProduct(product) {
      return {
        productId: product.productId,
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        isAvailable: product.isAvailable,
        isFeatured: product.isFeatured,
        sortOrder: product.sortOrder ?? 0,
      };
    },
    debugLog: () => {},
  });
  const page = createStorefrontOrderPage({
    getBusinessBySlugWithProducts,
    StorefrontOrderWizard() {
      return React.createElement("div", { "data-marker": "storefront-wizard" }, "activo");
    },
  });

  const html = render(
    await page({ params: Promise.resolve({ businessSlug: "legacy-shop" }) }),
  );

  assert.match(html, /Negocio no encontrado/);
  assert.doesNotMatch(html, /storefront-wizard/);
});
