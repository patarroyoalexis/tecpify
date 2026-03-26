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
const {
  deriveInitialOrderStateFromPaymentMethod,
  resolveAuthoritativeOrderStatePatch,
} = loadTsModule("lib/orders/state-rules.ts");

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

test("dominio: el estado inicial se deriva en servidor segun la regla de pago real", () => {
  assert.deepEqual(deriveInitialOrderStateFromPaymentMethod("Nequi"), {
    status: "pendiente de pago",
    paymentStatus: "pendiente",
  });
  assert.deepEqual(deriveInitialOrderStateFromPaymentMethod("Efectivo"), {
    status: "confirmado",
    paymentStatus: "verificado",
  });
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

test("POST /api/orders ignora status enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
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
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
      total: 30000,
      status: "confirmado",
      history: [{ id: "fake", title: "Fake", description: "Fake", occurredAt: "2026-03-25T21:00:00.000Z" }],
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(receivedPayload.status, undefined);
  assert.equal(receivedPayload.history, undefined);
});

test("POST /api/orders ignora paymentStatus enviado por cliente", async () => {
  let receivedPayload = null;
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
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
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 2, unitPrice: 15000 }],
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

test("dominio: PATCH rechaza combinaciones incoherentes entre estado y pago", () => {
  const error = (() => {
    try {
      resolveAuthoritativeOrderStatePatch(
        {
          paymentMethod: "Nequi",
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

  assert.match(error, /pago no este verificado/i);
});

test("dominio: PATCH acepta transicion valida y deriva status complementario desde servidor", () => {
  const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
    {
      paymentMethod: "Nequi",
      paymentStatus: "pendiente",
      status: "pendiente de pago",
    },
    {
      paymentStatus: "verificado",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    paymentMethod: "Nequi",
    paymentStatus: "verificado",
    status: "pago por verificar",
  });
  assert.deepEqual(resolvedStatePatch.changedFields.sort(), ["paymentStatus", "status"]);
  assert.deepEqual(resolvedStatePatch.derivedFields, ["status"]);
});

test("regresion: ninguna ruta o helper persiste estados sensibles sin pasar por el nucleo central", () => {
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
    /resolveAuthoritativeOrderStatePatch/,
    "La persistencia debe resolver el snapshot autoritativo antes de tocar status o payment_status.",
  );
  assert.match(
    ordersServerSource,
    /status:\s*nextOrderState\.status/,
    "status debe persistirse desde el snapshot resuelto en servidor.",
  );
  assert.match(
    ordersServerSource,
    /payment_status:\s*nextOrderState\.paymentStatus/,
    "paymentStatus debe persistirse desde el snapshot resuelto en servidor.",
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
