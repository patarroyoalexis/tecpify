/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

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

function render(element) {
  return renderToStaticMarkup(element);
}

test("legacy ownerless: negocio sin owner queda bloqueado en acceso privado y marcado como no soportado", () => {
  assert.equal(LEGACY_BUSINESS_OWNERSHIP_STRATEGY.mode, "unsupported_ownerless_blocked");

  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ ownerUserId: null }),
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
        businessId: "biz-legacy",
        businessSlug: "legacy-shop",
        ownerUserId: null,
      },
      OWNER_ID,
    ),
    null,
  );
  assert.equal(
    canAccessBusiness(OWNER_ID, {
      businessId: "biz-legacy",
      businessSlug: "legacy-shop",
      ownerUserId: null,
    }),
    false,
  );
});

test("legacy ownerless: negocio sin owner sigue bloqueado para recibir pedidos operativos", async () => {
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
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
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 1, unitPrice: 15000 }],
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
      id: "biz-legacy",
      slug: "legacy-shop",
      name: "Legacy Shop",
      createdAt: "2026-03-25T21:00:00.000Z",
      updatedAt: "2026-03-25T21:00:00.000Z",
      createdByUserId: null,
    }),
    getProductsByBusinessId: async () => [createProductFixture()],
    mapProductToBusinessProduct(product) {
      return {
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        isAvailable: product.is_available,
        isFeatured: product.is_featured,
        sortOrder: product.sort_order ?? 0,
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
  assert.equal(
    fs.existsSync(
      path.join(process.cwd(), "components", "home", "legacy-business-remediation-panel.tsx"),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        process.cwd(),
        "app",
        "api",
        "businesses",
        "legacy-remediation",
        "request",
        "route.ts",
      ),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        process.cwd(),
        "app",
        "api",
        "businesses",
        "legacy-remediation",
        "claim",
        "route.ts",
      ),
    ),
    false,
  );
});

test("legacy ownerless: la migracion final elimina la remediacion SQL y bloquea ownerless -> owned", () => {
  const migrationSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260326_retire_legacy_business_runtime_remediation.sql",
    ),
    "utf8",
  );

  assert.match(
    migrationSource,
    /drop function if exists public\.request_legacy_business_ownership_remediation\(text\)/i,
    "La estrategia final debe retirar la solicitud runtime de remediacion.",
  );
  assert.match(
    migrationSource,
    /drop function if exists public\.claim_legacy_business_ownership\(text\)/i,
    "La estrategia final debe retirar el claim runtime legacy.",
  );
  assert.match(
    migrationSource,
    /drop table if exists public\.legacy_business_ownership_remediations cascade/i,
    "La estrategia final no debe dejar la remediacion solo en SQL.",
  );
  assert.match(
    migrationSource,
    /legacy businesses without owner are unsupported in the MVP and cannot be claimed or reassigned in runtime/i,
    "La base debe bloquear definitivamente ownerless -> owned dentro del MVP.",
  );
  assert.match(
    migrationSource,
    /create trigger businesses_block_unsupported_legacy_owner_assignment/i,
    "La base debe cablear el veto definitivo de ownerless -> owned.",
  );
});

test("legacy ownerless: negocio con owner real sigue accesible para owner correcto y bloqueado para usuario ajeno", () => {
  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ ownerUserId: OWNER_ID }),
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
        businessId: "biz-owned",
        businessSlug: "mi-tienda",
        ownerUserId: OWNER_ID,
      },
      OWNER_ID,
    ),
    "owned",
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: "biz-owned",
        businessSlug: "mi-tienda",
        ownerUserId: OWNER_ID,
      },
      NON_OWNER_ID,
    ),
    null,
  );
});
