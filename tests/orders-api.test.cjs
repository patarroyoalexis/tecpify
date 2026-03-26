/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { NextResponse } = require("next/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { createOrdersRouteHandlers } = loadTsModule("app/api/orders/route.ts");
const { createWorkspaceOrdersRouteHandlers } = loadTsModule(
  "app/api/orders/private/route.ts",
);
const { createOrderByIdRouteHandlers } = loadTsModule(
  "app/api/orders/[orderId]/route.ts",
);
const { buildInitialOrderServerState } = loadTsModule("lib/orders/mappers.ts");

const ORDER_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac001";

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

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("dominio: el servidor deriva metadatos iniciales segun el origen del pedido", () => {
  const storefrontState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    paymentMethod: "Nequi",
    source: "storefront",
  });
  const workspaceState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    paymentMethod: "Nequi",
    source: "workspace",
  });

  assert.equal(storefrontState.status, "pendiente de pago");
  assert.equal(storefrontState.paymentStatus, "pendiente");
  assert.equal(storefrontState.isReviewed, false);
  assert.match(storefrontState.history[0].title, /formulario publico/i);

  assert.equal(workspaceState.status, "pendiente de pago");
  assert.equal(workspaceState.paymentStatus, "pendiente");
  assert.equal(workspaceState.isReviewed, false);
  assert.match(workspaceState.history[0].title, /creado manualmente/i);
  assert.match(workspaceState.history[0].description, /workspace privado/i);
});

test("POST /api/orders crea un pedido valido desde storefront", async () => {
  let receivedPayload = null;
  let receivedOptions = null;
  const expectedOrder = createOrderFixture();
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("getOrdersByBusinessIdFromDatabase no debe usarse en POST");
    },
    createOrderInDatabase: async (payload, options) => {
      receivedPayload = payload;
      receivedOptions = options;
      return expectedOrder;
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders", "POST", {
      businessSlug: " Mi-Tienda ",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      notes: "Sin cebolla",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.persistedRemotely, true);
  assert.equal(body.orderCode, expectedOrder.orderCode);
  assert.equal(receivedPayload.businessSlug, "mi-tienda");
  assert.deepEqual(receivedOptions, { source: "storefront" });
  assert.equal(body.order.id, expectedOrder.id);
});

test("POST /api/orders rechaza metadatos operativos enviados por cliente", async () => {
  let createOrderWasCalled = false;
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("getOrdersByBusinessIdFromDatabase no debe usarse en POST");
    },
    createOrderInDatabase: async () => {
      createOrderWasCalled = true;
      return createOrderFixture();
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders", "POST", {
      businessSlug: "mi-tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      status: "confirmado",
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /status/);
  assert.match(body.error, /history/);
  assert.equal(createOrderWasCalled, false);
});

test("POST /api/orders/private crea un pedido manual autenticado", async () => {
  let receivedPayload = null;
  let receivedOptions = null;
  const expectedOrder = createOrderFixture();
  const handlers = createWorkspaceOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "biz-1",
        businessSlug,
        businessName: "Mi tienda",
        ownerUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    createOrderInDatabase: async (payload, options) => {
      receivedPayload = payload;
      receivedOptions = options;
      return expectedOrder;
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: " Mi-Tienda ",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      notes: "Sin cebolla",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.persistedRemotely, true);
  assert.equal(receivedPayload.businessSlug, "mi-tienda");
  assert.deepEqual(receivedOptions, {
    source: "workspace",
    businessId: "biz-1",
  });
  assert.equal(body.order.id, expectedOrder.id);
});

test("GET /api/orders lee pedidos por negocio autenticado", async () => {
  let receivedBusinessId = null;
  let receivedOptions = null;
  const expectedOrders = [createOrderFixture()];
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "biz-1",
        businessSlug,
        businessName: "Mi tienda",
        ownerUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    getOrdersByBusinessIdFromDatabase: async (businessId, options) => {
      receivedBusinessId = businessId;
      receivedOptions = options;
      return expectedOrders;
    },
    createOrderInDatabase: async () => {
      throw new Error("createOrderInDatabase no debe usarse en GET");
    },
  });

  const response = await handlers.GET(
    new Request("http://localhost/api/orders?businessSlug=Mi-Tienda"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedBusinessId, "biz-1");
  assert.deepEqual(receivedOptions, { businessSlug: "mi-tienda" });
  assert.equal(body.orders.length, 1);
});

test("GET /api/orders bloquea ownership incorrecto en ruta privada", async () => {
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

test("PATCH /api/orders/[orderId] actualiza estado, pago, historial e isReviewed", async () => {
  let receivedOrderId = null;
  let receivedPayload = null;
  const updatedOrder = createOrderFixture({
    status: "confirmado",
    paymentStatus: "verificado",
    isReviewed: true,
    history: [
      {
        id: "event-1",
        title: "Pago verificado",
        description: "Validado desde dashboard",
        occurredAt: "2026-03-25T21:05:00.000Z",
      },
    ],
  });
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: true,
      context: {
        businessId: "biz-1",
        businessSlug: "mi-tienda",
        businessName: "Mi tienda",
        ownerUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    updateOrderInDatabase: async (orderId, payload) => {
      receivedOrderId = orderId;
      receivedPayload = payload;
      return updatedOrder;
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      status: "confirmado",
      paymentStatus: "verificado",
      isReviewed: true,
      history: updatedOrder.history,
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedOrderId, ORDER_ID);
  assert.deepEqual(receivedPayload, {
    status: "confirmado",
    paymentStatus: "verificado",
    isReviewed: true,
    history: updatedOrder.history,
  });
  assert.equal(body.persistedRemotely, true);
  assert.equal(body.order.isReviewed, true);
});

test("PATCH /api/orders/[orderId] bloquea acceso indebido al pedido", async () => {
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
