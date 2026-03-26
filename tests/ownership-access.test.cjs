/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NextResponse } = require("next/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  getBusinessAccessLevel,
  canAccessBusiness,
  hasVerifiedBusinessOwner,
} = loadTsModule("lib/auth/business-access.ts");
const { createBusinessesRouteHandlers } = loadTsModule("app/api/businesses/route.ts");
const { createOrdersRouteHandlers } = loadTsModule("app/api/orders/route.ts");
const { createWorkspaceOrdersRouteHandlers } = loadTsModule(
  "app/api/orders/private/route.ts",
);
const { createOrderByIdRouteHandlers } = loadTsModule("app/api/orders/[orderId]/route.ts");
const { createProductsRouteHandlers } = loadTsModule("app/api/products/route.ts");
const { createProductByIdRouteHandlers } = loadTsModule(
  "app/api/products/[productId]/route.ts",
);

const OWNER_ID = "user-owner";
const NON_OWNER_ID = "user-other";
const ORDER_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac001";
const PRODUCT_ID = "prod-1";

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createOwnedBusinessContext(overrides = {}) {
  return {
    businessId: "biz-1",
    businessSlug: "mi-tienda",
    businessName: "Mi tienda",
    ownerUserId: OWNER_ID,
    accessLevel: "owned",
    user: {
      userId: OWNER_ID,
      email: "owner@example.com",
      user: { id: OWNER_ID, email: "owner@example.com" },
    },
    ...overrides,
  };
}

function createOrderFixture(overrides = {}) {
  return {
    id: ORDER_ID,
    orderCode: "WEB-123456",
    businessSlug: "mi-tienda",
    client: "Ana Perez",
    customerPhone: "3001234567",
    products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
    total: 30000,
    paymentMethod: "Nequi",
    paymentStatus: "pendiente",
    deliveryType: "domicilio",
    address: "Calle 1 # 2-3",
    status: "pendiente de pago",
    dateLabel: "25 mar 2026, 4:00 p. m.",
    createdAt: "2026-03-25T21:00:00.000Z",
    isReviewed: false,
    history: [
      {
        id: "event-1",
        title: "Pedido creado",
        description: "Creado desde storefront",
        occurredAt: "2026-03-25T21:00:00.000Z",
      },
    ],
    observations: "Sin cebolla",
    ...overrides,
  };
}

function createProductFixture(overrides = {}) {
  return {
    id: PRODUCT_ID,
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

test("ownership: un negocio sin created_by_user_id verificable no obtiene acceso operativo", () => {
  assert.equal(hasVerifiedBusinessOwner("user-1"), true);
  assert.equal(hasVerifiedBusinessOwner(null), false);
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: "biz-1",
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
        businessId: "biz-legacy",
        businessSlug: "legacy",
        ownerUserId: null,
      },
      OWNER_ID,
    ),
    null,
  );
  assert.equal(
    canAccessBusiness(OWNER_ID, {
      businessId: "biz-legacy",
      businessSlug: "legacy",
      ownerUserId: null,
    }),
    false,
  );
  assert.equal(
    canAccessBusiness(NON_OWNER_ID, {
      businessId: "biz-1",
      businessSlug: "mi-tienda",
      ownerUserId: OWNER_ID,
    }),
    false,
  );
});

test("ownership: crear negocio exige sesion valida", async () => {
  let insertWasCalled = false;
  const handlers = createBusinessesRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireAuthenticatedApiUser: async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesion para usar este espacio operativo." },
        { status: 401 },
      ),
    }),
    createServerSupabaseAuthClient: async () => ({
      from() {
        insertWasCalled = true;
        throw new Error("No debe insertar sin sesion valida");
      },
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => "biz-1",
    getNow: () => "2026-03-25T21:00:00.000Z",
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/businesses", "POST", {
      name: "Mi tienda",
      slug: "mi-tienda",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Debes iniciar sesion para usar este espacio operativo.");
  assert.equal(insertWasCalled, false);
});

test("ownership: crear negocio rechaza owner enviado por cliente", async () => {
  let insertWasCalled = false;
  const handlers = createBusinessesRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireAuthenticatedApiUser: async () => ({
      ok: true,
      user: {
        userId: OWNER_ID,
        email: "owner@example.com",
        user: { id: OWNER_ID, email: "owner@example.com" },
      },
    }),
    createServerSupabaseAuthClient: async () => ({
      from() {
        insertWasCalled = true;
        throw new Error("No debe insertar payloads con owner client-side");
      },
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => "biz-1",
    getNow: () => "2026-03-25T21:00:00.000Z",
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/businesses", "POST", {
      name: "Mi tienda",
      slug: "mi-tienda",
      createdByUserId: NON_OWNER_ID,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /createdByUserId/);
  assert.equal(insertWasCalled, false);
});

test("ownership: crear negocio persiste created_by_user_id desde la sesion y no desde el cliente", async () => {
  let insertedPayload = null;
  const expectedRow = {
    id: "biz-1",
    slug: "mi-tienda",
    name: "Mi tienda",
    created_at: "2026-03-25T21:00:00.000Z",
    updated_at: "2026-03-25T21:00:00.000Z",
    created_by_user_id: OWNER_ID,
  };
  const handlers = createBusinessesRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireAuthenticatedApiUser: async () => ({
      ok: true,
      user: {
        userId: OWNER_ID,
        email: "owner@example.com",
        user: { id: OWNER_ID, email: "owner@example.com" },
      },
    }),
    createServerSupabaseAuthClient: async () => ({
      from(table) {
        assert.equal(table, "businesses");
        return {
          insert(payload) {
            insertedPayload = payload;
            return {
              select() {
                return {
                  async single() {
                    return { data: expectedRow, error: null };
                  },
                };
              },
            };
          },
        };
      },
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => "biz-1",
    getNow: () => "2026-03-25T21:00:00.000Z",
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/businesses", "POST", {
      name: " Mi tienda ",
      slug: "Mi-Tienda",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(insertedPayload.created_by_user_id, OWNER_ID);
  assert.equal(insertedPayload.slug, "mi-tienda");
  assert.equal(body.business.createdByUserId, OWNER_ID);
});

test("ownership: la lectura privada de pedidos exige sesion o contexto valido", async () => {
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesion para usar este espacio operativo." },
        { status: 401 },
      ),
    }),
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("No debe leer pedidos sin sesion valida");
    },
    createOrderInDatabase: async () => {
      throw new Error("No debe crear pedidos en GET");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/orders?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Debes iniciar sesion para usar este espacio operativo.");
});

test("ownership: owner puede leer pedidos de su negocio", async () => {
  const expectedOrders = [createOrderFixture()];
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    getOrdersByBusinessIdFromDatabase: async () => expectedOrders,
    createOrderInDatabase: async () => {
      throw new Error("createOrderInDatabase no debe usarse en GET");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/orders?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.orders.length, 1);
  assert.equal(body.orders[0].id, ORDER_ID);
});

test("ownership: no-owner no puede leer pedidos de un negocio ajeno", async () => {
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json({ error: "No tienes acceso a este negocio." }, { status: 403 }),
    }),
    getOrdersByBusinessIdFromDatabase: async () => [],
    createOrderInDatabase: async () => {
      throw new Error("createOrderInDatabase no debe usarse");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/orders?businessSlug=mi-tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "No tienes acceso a este negocio.");
});

test("ownership: crear pedidos publicos rechaza campos de ownership enviados por cliente", async () => {
  let createOrderWasCalled = false;
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => [],
    createOrderInDatabase: async () => {
      createOrderWasCalled = true;
      throw new Error("No debe persistir payloads con ownership client-side");
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders", "POST", {
      businessSlug: "mi-tienda",
      businessId: "biz-ajeno",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /businessId/);
  assert.equal(createOrderWasCalled, false);
});

test("ownership: crear pedidos manuales exige sesion valida", async () => {
  let createOrderWasCalled = false;
  const handlers = createWorkspaceOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesion para usar este espacio operativo." },
        { status: 401 },
      ),
    }),
    createOrderInDatabase: async () => {
      createOrderWasCalled = true;
      throw new Error("No debe crear pedidos manuales sin sesion valida");
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: "mi-tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Debes iniciar sesion para usar este espacio operativo.");
  assert.equal(createOrderWasCalled, false);
});

test("ownership: owner puede crear pedidos manuales solo dentro de su negocio", async () => {
  let receivedPayload = null;
  let receivedOptions = null;
  const handlers = createWorkspaceOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: createOwnedBusinessContext({ businessSlug }),
    }),
    createOrderInDatabase: async (payload, options) => {
      receivedPayload = payload;
      receivedOptions = options;
      return createOrderFixture();
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: "Mi-Tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.businessSlug, "mi-tienda");
  assert.deepEqual(receivedOptions, {
    origin: "workspace_manual",
    businessId: "biz-1",
  });
  assert.equal(body.order.id, ORDER_ID);
});

test("ownership: no-owner no puede crear pedidos manuales en negocio ajeno", async () => {
  let createOrderWasCalled = false;
  const handlers = createWorkspaceOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => ({
      ok: false,
      response: NextResponse.json({ error: "No tienes acceso a este negocio." }, { status: 403 }),
    }),
    createOrderInDatabase: async () => {
      createOrderWasCalled = true;
      throw new Error("No debe crear pedidos manuales en negocio ajeno");
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: "mi-tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "No tienes acceso a este negocio.");
  assert.equal(createOrderWasCalled, false);
});

test("ownership: owner puede mutar pedidos de su negocio", async () => {
  const updatedOrder = createOrderFixture({
    status: "confirmado",
    paymentStatus: "verificado",
    isReviewed: true,
  });
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    updateOrderInDatabase: async () => updatedOrder,
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      status: "confirmado",
      paymentStatus: "verificado",
      isReviewed: true,
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.order.status, "confirmado");
  assert.equal(body.order.paymentStatus, "verificado");
});

test("ownership: no-owner no puede mutar pedidos ajenos", async () => {
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: false,
      response: NextResponse.json({ error: "No tienes acceso a este pedido." }, { status: 403 }),
    }),
    updateOrderInDatabase: async () => {
      throw new Error("updateOrderInDatabase no debe usarse");
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      status: "confirmado",
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, "No tienes acceso a este pedido.");
});

test("ownership: crear producto rechaza businessId enviado por cliente", async () => {
  let createProductWasCalled = false;
  const handlers = createProductsRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    getAdminProductsByBusinessId: async () => [],
    createProductInDatabase: async () => {
      createProductWasCalled = true;
      throw new Error("No debe mutar con businessId del cliente");
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/products", "POST", {
      businessSlug: "mi-tienda",
      businessId: "biz-ajeno",
      name: "Hamburguesa",
      price: 15000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /businessId/);
  assert.equal(createProductWasCalled, false);
});

test("ownership: crear producto usa businessId resuelto desde contexto server-side", async () => {
  let receivedPayload = null;
  const createdProduct = createProductFixture();
  const handlers = createProductsRouteHandlers({
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: createOwnedBusinessContext({ businessSlug }),
    }),
    getAdminProductsByBusinessId: async () => [],
    createProductInDatabase: async (payload) => {
      receivedPayload = payload;
      return createdProduct;
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/products", "POST", {
      businessSlug: "mi-tienda",
      name: "Hamburguesa",
      price: 15000,
      isAvailable: true,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.businessId, "biz-1");
  assert.equal(body.product.id, PRODUCT_ID);
});

test("ownership: actualizar producto rechaza businessId enviado por cliente", async () => {
  let updateWasCalled = false;
  const handlers = createProductByIdRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    updateProductInDatabase: async () => {
      updateWasCalled = true;
      throw new Error("No debe mutar con businessId del cliente");
    },
    deleteProductInDatabase: async () => {
      throw new Error("deleteProductInDatabase no debe usarse");
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/products/${PRODUCT_ID}`, "PATCH", {
      businessSlug: "mi-tienda",
      businessId: "biz-ajeno",
      price: 17000,
    }),
    { params: Promise.resolve({ productId: PRODUCT_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /businessId/);
  assert.equal(updateWasCalled, false);
});

test("ownership: actualizar producto usa businessId resuelto desde contexto server-side", async () => {
  let receivedProductId = null;
  let receivedPayload = null;
  const updatedProduct = createProductFixture({ price: 17000, updated_at: "2026-03-25T21:05:00.000Z" });
  const handlers = createProductByIdRouteHandlers({
    requireBusinessApiContext: async () => ({
      ok: true,
      context: createOwnedBusinessContext(),
    }),
    updateProductInDatabase: async (productId, payload) => {
      receivedProductId = productId;
      receivedPayload = payload;
      return updatedProduct;
    },
    deleteProductInDatabase: async () => {
      throw new Error("deleteProductInDatabase no debe usarse");
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/products/${PRODUCT_ID}`, "PATCH", {
      businessSlug: "mi-tienda",
      price: 17000,
    }),
    { params: Promise.resolve({ productId: PRODUCT_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedProductId, PRODUCT_ID);
  assert.equal(receivedPayload.businessId, "biz-1");
  assert.equal(body.product.price, 17000);
});

test("ownership: un negocio legacy sin owner queda bloqueado para crear pedidos publicos", async () => {
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
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.match(body.error, /blocked until it has a real owner/i);
});

test("ownership: la migracion operativa impide nuevos negocios sin owner y evita volver a null", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260325_enforce_business_owner_presence.sql",
  );
  const migrationSource = fs.readFileSync(migrationPath, "utf8");

  assert.match(migrationSource, /create or replace function public\.enforce_business_owner_presence/i);
  assert.match(migrationSource, /raise exception 'businesses\.created_by_user_id is required/i);
  assert.match(migrationSource, /before insert or update on public\.businesses/i);
  assert.match(migrationSource, /on delete restrict/i);
});
