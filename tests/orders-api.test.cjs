/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
const { appendServerGeneratedOrderHistory } = loadTsModule("lib/orders/history-rules.ts");
const {
  deriveInitialOrderStateFromPaymentMethod,
  resolveAuthoritativeOrderStatePatch,
} = loadTsModule("lib/orders/state-rules.ts");

const ORDER_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac001";
const PRODUCT_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac002";

function createOrderFixture(overrides = {}) {
  return {
    orderId: ORDER_ID,
    orderCode: "WEB-123456",
    businessSlug: "mi-tienda",
    client: "Ana Perez",
    customerPhone: "3001234567",
    products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
    total: 30000,
    paymentMethod: "Transferencia",
    paymentStatus: "pendiente",
    isFiado: false,
    fiadoStatus: null,
    fiadoObservation: null,
    previousStatusBeforeCancellation: null,
    cancellationReason: null,
    cancellationDetail: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancelledByUserEmail: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivatedByUserEmail: null,
    deliveryType: "domicilio",
    address: "Calle 1 # 2-3",
    status: "nuevo",
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

test("POST publico genera historial inicial server-side", () => {
  const storefrontState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    origin: "public_form",
  });

  assert.equal(storefrontState.history.length, 2);
  assert.match(storefrontState.history[0].title, /formulario publico/i);
  assert.match(storefrontState.history[0].description, /formulario publico/i);
});

test("POST manual genera historial inicial server-side", () => {
  const workspaceState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    origin: "workspace_manual",
  });

  assert.equal(workspaceState.history.length, 2);
  assert.match(workspaceState.history[0].title, /creado manualmente/i);
  assert.match(workspaceState.history[0].description, /workspace privado/i);
});

test("dominio: el primer evento del historial difiere segun el origen real", () => {
  const storefrontState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    origin: "public_form",
  });
  const workspaceState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    origin: "workspace_manual",
  });

  assert.notEqual(storefrontState.history[0].title, workspaceState.history[0].title);
  assert.notEqual(
    storefrontState.history[0].description,
    workspaceState.history[0].description,
  );
});

test("dominio: el estado inicial se deriva en servidor segun la regla de pago real", () => {
  assert.deepEqual(deriveInitialOrderStateFromPaymentMethod("Transferencia"), {
    status: "nuevo",
    paymentStatus: "pendiente",
  });
  assert.deepEqual(deriveInitialOrderStateFromPaymentMethod("Efectivo"), {
    status: "nuevo",
    paymentStatus: "verificado",
  });
});

test("dominio: POST server-side rechaza Contra entrega fuera de domicilio", () => {
  assert.throws(
    () =>
      buildInitialOrderServerState({
        orderId: ORDER_ID,
        businessSlug: "mi-tienda",
        createdAt: "2026-03-25T21:00:00.000Z",
        deliveryType: "recogida en tienda",
        paymentMethod: "Contra entrega",
        origin: "public_form",
      }),
    /Contra entrega solo se permite en pedidos a domicilio/i,
  );
});

test("dominio: POST server-side acepta Contra entrega solo cuando el pedido es a domicilio", () => {
  const serverState = buildInitialOrderServerState({
    orderId: ORDER_ID,
    businessSlug: "mi-tienda",
    createdAt: "2026-03-25T21:00:00.000Z",
    deliveryType: "domicilio",
    paymentMethod: "Contra entrega",
    origin: "public_form",
  });

  assert.equal(serverState.status, "nuevo");
  assert.equal(serverState.paymentStatus, "verificado");
});

test("POST /api/orders crea un pedido valido desde storefront", async () => {
  let receivedPayload = null;
  let receivedOptions = null;
  const expectedOrder = createOrderFixture();
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
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
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      notes: "Sin cebolla",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.persistedRemotely, true);
  assert.equal(body.orderCode, expectedOrder.orderCode);
  assert.equal(receivedPayload.businessSlug, "mi-tienda");
  assert.deepEqual(receivedOptions, { origin: "public_form" });
  assert.equal(body.order.orderId, expectedOrder.orderId);
});

test("POST /api/orders rechaza product_id legacy dentro de products", async () => {
  let createOrderWasCalled = false;
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
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
      paymentMethod: "Transferencia",
      products: [{ product_id: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /products\[0\]\.product_id/i);
  assert.equal(createOrderWasCalled, false);
});

test("POST /api/orders ignora status enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("getOrdersByBusinessIdFromDatabase no debe usarse en POST");
    },
    createOrderInDatabase: async (payload) => {
      receivedPayload = payload;
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
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      status: "confirmado",
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.status, undefined);
  assert.equal(receivedPayload.history, undefined);
});

test("POST /api/orders ignora history enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("getOrdersByBusinessIdFromDatabase no debe usarse en POST");
    },
    createOrderInDatabase: async (payload) => {
      receivedPayload = payload;
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
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.history, undefined);
});

test("POST /api/orders ignora paymentStatus enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => {
      throw new Error("getOrdersByBusinessIdFromDatabase no debe usarse en POST");
    },
    createOrderInDatabase: async (payload) => {
      receivedPayload = payload;
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
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      paymentStatus: "verificado",
      isReviewed: true,
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.paymentStatus, undefined);
  assert.equal(receivedPayload.isReviewed, undefined);
});

test("POST /api/orders/private crea un pedido manual autenticado", async () => {
  let receivedPayload = null;
  let receivedOptions = null;
  const expectedOrder = createOrderFixture();
  const handlers = createWorkspaceOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug,
        businessName: "Mi tienda",
        createdByUserId: "user-1",
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
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      notes: "Sin cebolla",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.persistedRemotely, true);
  assert.equal(receivedPayload.businessSlug, "mi-tienda");
  assert.deepEqual(receivedOptions, {
    origin: "workspace_manual",
    businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
  });
  assert.equal(body.order.orderId, expectedOrder.orderId);
});

test("POST /api/orders/private rechaza product_id legacy dentro de products", async () => {
  let createOrderWasCalled = false;
  const handlers = createWorkspaceOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug,
        businessName: "Mi tienda",
        createdByUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    createOrderInDatabase: async () => {
      createOrderWasCalled = true;
      return createOrderFixture();
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: "mi-tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Transferencia",
      products: [{ product_id: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /products\[0\]\.product_id/i);
  assert.equal(createOrderWasCalled, false);
});

test("POST /api/orders/private ignora history enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createWorkspaceOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug,
        businessName: "Mi tienda",
        createdByUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    createOrderInDatabase: async (payload) => {
      receivedPayload = payload;
      return createOrderFixture();
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders/private", "POST", {
      businessSlug: "mi-tienda",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.history, undefined);
});

test("GET /api/orders lee pedidos por negocio autenticado", async () => {
  let receivedBusinessId = null;
  let receivedOptions = null;
  const expectedOrders = [createOrderFixture()];
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug,
        businessName: "Mi tienda",
        createdByUserId: "user-1",
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
  assert.equal(receivedBusinessId, "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101");
  assert.deepEqual(receivedOptions, { businessSlug: "mi-tienda" });
  assert.equal(body.orders.length, 1);
});

test("GET /api/orders bloquea ownership incorrecto en ruta privada", async () => {
  const handlers = createOrdersRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
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

test("PATCH /api/orders/[orderId] actualiza solo cambios editables e intents controlados", async () => {
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
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug: "mi-tienda",
        businessName: "Mi tienda",
        createdByUserId: "user-1",
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
      eventIntent: "mark_reviewed_from_operation",
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
    eventIntent: "mark_reviewed_from_operation",
  });
  assert.equal(body.persistedRemotely, true);
  assert.equal(body.order.isReviewed, true);
});

test("PATCH /api/orders/[orderId] envia cancelacion excepcional con motivo obligatorio", async () => {
  let receivedPayload = null;
  const cancelledOrder = createOrderFixture({
    status: "cancelado",
    previousStatusBeforeCancellation: "nuevo",
    cancellationReason: "cliente_canceló",
    cancellationDetail: null,
  });
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug: "mi-tienda",
        businessName: "Mi tienda",
        createdByUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    updateOrderInDatabase: async (_orderId, payload) => {
      receivedPayload = payload;
      return cancelledOrder;
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      status: "cancelado",
      cancellationReason: "cliente_canceló",
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(receivedPayload, {
    status: "cancelado",
    cancellationReason: "cliente_canceló",
  });
  assert.equal(body.order.status, "cancelado");
  assert.equal(body.order.previousStatusBeforeCancellation, "nuevo");
});

test("PATCH /api/orders/[orderId] envia reactivacion controlada al backend", async () => {
  let receivedPayload = null;
  const reactivatedOrder = createOrderFixture({
    status: "en preparación",
    previousStatusBeforeCancellation: null,
    cancellationReason: null,
  });
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug: "mi-tienda",
        businessName: "Mi tienda",
        createdByUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    updateOrderInDatabase: async (_orderId, payload) => {
      receivedPayload = payload;
      return reactivatedOrder;
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      reactivateCancelledOrder: true,
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(receivedPayload, {
    reactivateCancelledOrder: true,
  });
  assert.equal(body.order.status, "en preparación");
});

test("PATCH /api/orders/[orderId] falla si intenta reemplazar historial completo", async () => {
  let updateOrderWasCalled = false;
  const handlers = createOrderByIdRouteHandlers({
    requireOrderApiContext: async () => ({
      ok: true,
      context: {
        businessId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101",
        businessSlug: "mi-tienda",
        businessName: "Mi tienda",
        createdByUserId: "user-1",
        accessLevel: "owned",
        user: {
          userId: "user-1",
          email: "owner@example.com",
          user: { id: "user-1", email: "owner@example.com" },
        },
      },
    }),
    updateOrderInDatabase: async () => {
      updateOrderWasCalled = true;
      return createOrderFixture();
    },
  });

  const response = await handlers.PATCH(
    createJsonRequest(`http://localhost/api/orders/${ORDER_ID}`, "PATCH", {
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
    { params: Promise.resolve({ orderId: ORDER_ID }) },
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /campos no permitidos/i);
  assert.match(body.error, /history/i);
  assert.equal(updateOrderWasCalled, false);
});

test("dominio: PATCH rechaza combinaciones incoherentes entre estado y pago", () => {
  const error = (() => {
    try {
      resolveAuthoritativeOrderStatePatch(
        {
          deliveryType: "domicilio",
          paymentMethod: "Transferencia",
          paymentStatus: "verificado",
          status: "confirmado",
        },
        {
          paymentStatus: "pendiente",
        },
      );
      return null;
    } catch (patchError) {
      return patchError instanceof Error ? patchError.message : String(patchError);
    }
  })();

  assert.match(error, /condici[oó]n financiera|compuerta/i);
});

test("dominio: PATCH acepta transicion valida y deriva status complementario desde servidor", () => {
  const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
    {
      deliveryType: "domicilio",
      paymentMethod: "Transferencia",
      paymentStatus: "pendiente",
      status: "nuevo",
    },
    {
      paymentStatus: "verificado",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    paymentStatus: "verificado",
    status: "nuevo",
  });
  assert.deepEqual(resolvedStatePatch.changedFields.sort(), ["paymentStatus"]);
  assert.deepEqual(resolvedStatePatch.derivedFields, []);
});

test("dominio: PATCH server-side permite confirmar un pedido fiado aunque el pago siga pendiente", () => {
  const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
    {
      deliveryType: "domicilio",
      paymentMethod: "Transferencia",
      paymentStatus: "pendiente",
      status: "nuevo",
    },
    {
      status: "confirmado",
    },
    {
      isFiado: true,
      fiadoStatus: "pending",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    deliveryType: "domicilio",
    paymentMethod: "Transferencia",
    paymentStatus: "pendiente",
    status: "confirmado",
  });
  assert.deepEqual(resolvedStatePatch.changedFields, ["status"]);
});

test("dominio: los cambios posteriores al historial quedan controlados por servidor", () => {
  const currentHistory = [
    {
      id: "event-1",
      title: "Pedido creado desde formulario publico",
      description: "El cliente confirmo el pedido desde el formulario publico compartido del negocio.",
      occurredAt: "2026-03-25T21:00:00.000Z",
    },
  ];
  const nextHistory = appendServerGeneratedOrderHistory({
    orderId: ORDER_ID,
    occurredAt: "2026-03-25T21:05:00.000Z",
    currentHistory,
    currentOrder: {
      orderId: ORDER_ID,
      status: "nuevo",
      paymentStatus: "pendiente",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      notes: "Sin cebolla",
      total: 30000,
      isReviewed: false,
    },
    nextOrder: {
      orderId: ORDER_ID,
      status: "nuevo",
      paymentStatus: "pendiente",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Transferencia",
      products: [{ productId: PRODUCT_ID, name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      notes: "Sin cebolla",
      total: 30000,
      isReviewed: false,
    },
    eventIntent: "request_payment_proof_whatsapp",
  });

  assert.equal(nextHistory.length, 2);
  assert.match(nextHistory[0].title, /comprobante preparado/i);
  assert.equal(nextHistory[1].id, "event-1");
});

test("regresion: ninguna ruta o helper reintroduce history en contratos publicos o privados", () => {
  const publicOrdersRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "orders", "route.ts"),
    "utf8",
  );
  const privateOrdersRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "orders", "private", "route.ts"),
    "utf8",
  );
  const ordersServerSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "data", "orders-server.ts"),
    "utf8",
  );
  const orderByIdRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "orders", "[orderId]", "route.ts"),
    "utf8",
  );
  const orderStateRulesSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "orders", "state-rules.ts"),
    "utf8",
  );
  const historyRulesSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "orders", "history-rules.ts"),
    "utf8",
  );
  const businessOrdersHookSource = fs.readFileSync(
    path.join(process.cwd(), "components", "dashboard", "use-business-orders.ts"),
    "utf8",
  );
  const insertPayloadBlock = ordersServerSource.match(
    /const insertPayload = \{(?<block>[\s\S]*?)\n\s*};/,
  );
  const updatePayloadBlocks = [
    ...ordersServerSource.matchAll(/updatePayload\s*=\s*\{(?<block>[\s\S]*?)\n\s*};/g),
  ];
  const updateAllowedFieldsBlock = orderStateRulesSource.match(
    /export const ORDER_UPDATE_CLIENT_EDITABLE_FIELDS = \[(?<fields>[\s\S]*?)\] as const;/,
  );

  assert.match(
    publicOrdersRouteSource,
    /sanitizeClientCreateOrderPayload/,
    "El POST publico debe sanear estados derivados antes de persistir.",
  );
  assert.match(
    privateOrdersRouteSource,
    /sanitizeClientCreateOrderPayload/,
    "El POST privado debe sanear estados derivados antes de persistir.",
  );
  assert.match(
    ordersServerSource,
    /rpc\("update_order_with_server_history"/,
    "La mutacion server-side debe pasar por la funcion controlada de DB para anexar historial.",
  );
  assert.doesNotMatch(
    ordersServerSource,
    /appendServerGeneratedOrderHistory/,
    "La capa de datos no debe volver a persistir snapshots completos de history desde Next.js.",
  );
  assert.ok(
    insertPayloadBlock?.groups?.block,
    "La persistencia del insert debe conservar un bloque identificable para guardrails.",
  );
  assert.doesNotMatch(
    insertPayloadBlock.groups.block,
    /\bhistory:/,
    "El insert persistido no debe volver a incluir history como payload directo.",
  );
  assert.ok(
    updatePayloadBlocks.length > 0,
    "La persistencia del patch debe conservar bloques identificables para guardrails.",
  );
  for (const updatePayloadBlock of updatePayloadBlocks) {
    assert.ok(
      updatePayloadBlock.groups?.block,
      "Cada bloque de patch persistido debe poder auditarse.",
    );
    assert.doesNotMatch(
      updatePayloadBlock.groups.block,
      /\bhistory:/,
      "El patch persistido no debe volver a incluir history como payload directo.",
    );
  }
  assert.match(
    historyRulesSource,
    /createInitialOrderHistory/,
    "El historial inicial debe vivir en un modulo central server-side.",
  );
  assert.match(
    orderByIdRouteSource,
    /ORDER_UPDATE_CLIENT_EDITABLE_FIELDS/,
    "La ruta PATCH debe seguir dependiendo del contrato central editable.",
  );
  assert.ok(
    updateAllowedFieldsBlock?.groups?.fields,
    "El contrato editable del PATCH debe permanecer centralizado.",
  );
  assert.doesNotMatch(
    updateAllowedFieldsBlock.groups.fields,
    /"history"/,
    "history no debe volver al contrato editable del PATCH.",
  );
  assert.match(
    updateAllowedFieldsBlock.groups.fields,
    /"eventIntent"/,
    "El PATCH debe usar un intent controlado en vez de snapshots completos de history.",
  );
  assert.doesNotMatch(
    businessOrdersHookSource,
    /createHistoryEvent|appendOrderEvent|history:\s/,
    "El cliente no debe volver a fabricar snapshots de historial antes del PATCH.",
  );
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
