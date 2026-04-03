/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");
const {
  formatTransitions,
  getLegacyOwnerlessSqlClosureState,
} = require("./helpers/sql-migration-state.cjs");

const {
  getBusinessAccessLevel,
  canAccessBusiness,
} = loadTsModule("lib/auth/business-access.ts");
const {
  LEGACY_BUSINESS_OWNERSHIP_STRATEGY,
  resolveLegacyBusinessOwnershipState,
} = loadTsModule("lib/auth/legacy-business-access.ts");
const { createOrdersRouteHandlers } = loadTsModule("app/api/orders/route.ts");
const { createStorefrontOrderPage } = loadTsModule(
  "lib/page-contracts/storefront-order-page.ts",
);
const { createGetBusinessBySlugWithProducts } = loadTsModule("data/businesses.ts");

const OWNER_ID = "user-owner";
const NON_OWNER_ID = "user-other";
const LEGACY_BUSINESS_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac199";
const OWNED_BUSINESS_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101";
const PRODUCT_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac002";

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createProductFixture(overrides = {}) {
  return {
    productId: PRODUCT_ID,
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

function render(element) {
  return renderToStaticMarkup(element);
}

test("legacy ownerless: negocio sin owner queda bloqueado en acceso privado y marcado como no soportado", () => {
  assert.equal(LEGACY_BUSINESS_OWNERSHIP_STRATEGY.mode, "unsupported_ownerless_blocked");

  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ createdByUserId: null }),
    {
      runtimeStatus: "ownerless_unsupported",
      accessStatus: "inaccessible",
      isSupported: false,
      isAccessible: false,
    },
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: LEGACY_BUSINESS_ID,
        businessSlug: "legacy-shop",
        isActive: false,
        createdByUserId: null,
      },
      OWNER_ID,
    ),
    null,
  );
  assert.equal(
    canAccessBusiness(OWNER_ID, {
      businessId: LEGACY_BUSINESS_ID,
      businessSlug: "legacy-shop",
      isActive: false,
      createdByUserId: null,
    }),
    false,
  );
});

test("legacy ownerless: negocio sin owner sigue bloqueado para recibir pedidos operativos", async () => {
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => [],
    createOrderInDatabase: async () => {
      throw new Error(
        'Business "legacy-shop" is blocked until it has a real owner in created_by_user_id.',
      );
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders", "POST", {
      businessSlug: "legacy-shop",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 1, unitPrice: 15000 }],
      total: 15000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.match(body.error, /blocked until it has a real owner/i);
});

test("legacy ownerless: storefront sigue bloqueado y no vuelve operativo un negocio sin owner", async () => {
  const getBusinessBySlugWithProducts = createGetBusinessBySlugWithProducts({
    getBusinessBySlugFromDatabase: async () => ({
      businessId: LEGACY_BUSINESS_ID,
      businessSlug: "legacy-shop",
      name: "Legacy Shop",
      isActive: true,
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

test("legacy ownerless: la home operativa muestra la estrategia final sin prometer remediacion runtime", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components", "home", "operational-home.tsx"),
    "utf8",
  );

  assert.match(source, /No soportados en runtime del MVP/);
  assert.match(
    source,
    /Permanecen bloqueados fuera del workspace, del storefront publico y de los pedidos\s+operativos/,
  );
  assert.match(source, /Tecpify ya no ofrece remediacion ni claim dentro del producto/);
  assert.doesNotMatch(source, /Solicitar remediacion legacy|Reclamar ownership|Habilitar claim controlado/);
});

test("legacy ownerless: el repo ya no expone panel ni rutas runtime de remediacion", () => {
  for (const relativePath of [
    path.join("components", "home", "legacy-business-remediation-panel.tsx"),
    path.join("app", "api", "businesses", "legacy-remediation", "request", "route.ts"),
    path.join("app", "api", "businesses", "legacy-remediation", "grant", "route.ts"),
    path.join("app", "api", "businesses", "legacy-remediation", "claim", "route.ts"),
    path.join("app", "api", "businesses", "legacy-remediation", "list", "route.ts"),
  ]) {
    assert.equal(fs.existsSync(path.join(process.cwd(), relativePath)), false, relativePath);
  }
});

test("legacy ownerless: la definicion final efectiva retira la superficie SQL request/grant/claim/list", () => {
  const sqlClosureState = getLegacyOwnerlessSqlClosureState();

  for (const retiredSurface of [
    ...sqlClosureState.forbiddenTables,
    ...sqlClosureState.forbiddenFunctions,
    ...sqlClosureState.forbiddenTriggers,
  ]) {
    assert.equal(
      retiredSurface.state,
      "absent",
      `${retiredSurface.name} debe quedar ausente en la definicion final efectiva. Transiciones: ${formatTransitions(retiredSurface.transitions)}`,
    );
  }

  for (const grantState of sqlClosureState.authenticatedGrantStates) {
    assert.equal(
      grantState.granted,
      false,
      `${grantState.name} no puede quedar otorgado a authenticated. Transiciones: ${formatTransitions(grantState.transitions)}`,
    );
  }
});

test("legacy ownerless: la definicion final efectiva conserva el veto ownerless -> owned", () => {
  const sqlClosureState = getLegacyOwnerlessSqlClosureState();

  assert.equal(
    sqlClosureState.blockerFunction.state,
    "present",
    `La funcion veto final debe seguir presente. Transiciones: ${formatTransitions(sqlClosureState.blockerFunction.transitions)}`,
  );
  assert.equal(
    sqlClosureState.blockerTrigger.state,
    "present",
    `El trigger veto final debe seguir presente. Transiciones: ${formatTransitions(sqlClosureState.blockerTrigger.transitions)}`,
  );
  assert.ok(
    sqlClosureState.blockerFunction.latestMigration,
    "Debe existir una migracion efectiva que defina el veto final ownerless -> owned.",
  );
  assert.ok(
    sqlClosureState.blockerTrigger.latestMigration,
    "Debe existir una migracion efectiva que conecte el trigger veto ownerless -> owned.",
  );
  assert.match(
    sqlClosureState.blockerFunction.latestMigration.source,
    /legacy businesses without owner are unsupported in the MVP and cannot be claimed or reassigned in runtime/i,
    "La base debe declarar de forma explicita que ownerless no es remediable en runtime.",
  );
  assert.match(
    sqlClosureState.blockerTrigger.latestMigration.source,
    /create trigger businesses_block_unsupported_legacy_owner_assignment/i,
    "La base debe cablear el trigger veto definitivo de ownerless -> owned.",
  );
});

test("legacy ownerless: negocio con owner real sigue accesible para owner correcto y bloqueado para usuario ajeno", () => {
  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ createdByUserId: OWNER_ID }),
    {
      runtimeStatus: "owned",
      accessStatus: "accessible",
      isSupported: true,
      isAccessible: true,
    },
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: OWNED_BUSINESS_ID,
        businessSlug: "mi-tienda",
        isActive: true,
        createdByUserId: OWNER_ID,
      },
      OWNER_ID,
    ),
    "owned",
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: OWNED_BUSINESS_ID,
        businessSlug: "mi-tienda",
        isActive: true,
        createdByUserId: OWNER_ID,
      },
      NON_OWNER_ID,
    ),
    null,
  );
});
