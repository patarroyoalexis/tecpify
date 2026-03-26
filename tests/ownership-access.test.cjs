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
const { createOrdersRouteHandlers } = loadTsModule("app/api/orders/route.ts");
const { createOrderByIdRouteHandlers } = loadTsModule("app/api/orders/[orderId]/route.ts");

const OWNER_ID = "user-owner";
const NON_OWNER_ID = "user-other";
const ORDER_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac001";

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
