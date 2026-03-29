/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  PAYMENT_METHODS,
  isPendingFiadoOrder,
} = loadTsModule("types/orders.ts");
const { getCurrentIsoTimestamp } = loadTsModule("lib/operational-time.ts");
const {
  getPublicPaymentMethodsForBusiness,
} = loadTsModule("lib/businesses/payment-settings.ts");
const {
  ORDER_UPDATE_CLIENT_EDITABLE_FIELDS,
  resolveAuthoritativeOrderFiadoPatch,
} = loadTsModule("lib/orders/state-rules.ts");
const { getOrdersMetricsSummary } = loadTsModule("data/orders.ts");

function createOrderFixture(overrides = {}) {
  return {
    orderId: "0f9f5d8d-1234-4f6b-8f16-6e16b14ac001",
    orderCode: "WEB-123456",
    businessSlug: "mi-tienda",
    client: "Ana Perez",
    customerPhone: "3001234567",
    products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 1, unitPrice: 15000 }],
    total: 15000,
    paymentMethod: "Transferencia",
    paymentStatus: "verificado",
    isFiado: false,
    fiadoStatus: null,
    fiadoObservation: null,
    deliveryType: "domicilio",
    address: "Calle 1 # 2-3",
    status: "entregado",
    dateLabel: "28 mar 2026, 10:00 a. m.",
    createdAt: getCurrentIsoTimestamp(),
    isReviewed: true,
    history: [],
    observations: null,
    ...overrides,
  };
}

test("flags del negocio: el catalogo publico no expone Fiado y preserva Transferencia unificada", () => {
  assert.equal(PAYMENT_METHODS.includes("Transferencia"), true);
  assert.equal(PAYMENT_METHODS.includes("Nequi"), false);
  assert.equal(PAYMENT_METHODS.includes("Daviplata"), false);
  assert.equal(PAYMENT_METHODS.includes("Bre-B"), false);

  const methods = getPublicPaymentMethodsForBusiness({
    acceptsCash: false,
    acceptsTransfer: true,
    acceptsCard: true,
    allowsFiado: true,
  });

  assert.deepEqual(methods, ["Transferencia", "Tarjeta"]);
  assert.equal(methods.includes("Fiado"), false);
});

test("flags del negocio: efectivo habilita tambien contra entrega para el frente publico", () => {
  const methods = getPublicPaymentMethodsForBusiness({
    acceptsCash: true,
    acceptsTransfer: false,
    acceptsCard: false,
    allowsFiado: false,
  });

  assert.deepEqual(methods, ["Efectivo", "Contra entrega"]);
});

test("fiado: el PATCH privado reconoce los campos internos del contrato editable", () => {
  assert.equal(ORDER_UPDATE_CLIENT_EDITABLE_FIELDS.includes("isFiado"), true);
  assert.equal(ORDER_UPDATE_CLIENT_EDITABLE_FIELDS.includes("fiadoStatus"), true);
  assert.equal(ORDER_UPDATE_CLIENT_EDITABLE_FIELDS.includes("fiadoObservation"), true);
});

test("fiado: solo puede activarse si el negocio lo permite", () => {
  assert.throws(
    () =>
      resolveAuthoritativeOrderFiadoPatch(
        {
          isFiado: false,
          fiadoStatus: null,
          fiadoObservation: null,
        },
        {
          isFiado: true,
          fiadoStatus: "pending",
          fiadoObservation: "Paga manana",
        },
        { allowsFiado: false },
      ),
    /fiado interno/i,
  );
});

test("fiado: exige observacion obligatoria al activarlo", () => {
  assert.throws(
    () =>
      resolveAuthoritativeOrderFiadoPatch(
        {
          isFiado: false,
          fiadoStatus: null,
          fiadoObservation: null,
        },
        {
          isFiado: true,
          fiadoStatus: "pending",
          fiadoObservation: "   ",
        },
        { allowsFiado: true },
      ),
    /observacion de fiado es obligatoria/i,
  );
});

test("fiado: permite la transicion minima pending -> paid", () => {
  const result = resolveAuthoritativeOrderFiadoPatch(
    {
      isFiado: true,
      fiadoStatus: "pending",
      fiadoObservation: "Queda pendiente",
    },
    {
      fiadoStatus: "paid",
    },
    { allowsFiado: true },
  );

  assert.deepEqual(result.nextState, {
    isFiado: true,
    fiadoStatus: "paid",
    fiadoObservation: "Queda pendiente",
  });
  assert.deepEqual(result.changedFields, ["fiadoStatus"]);
});

test("metricas: un fiado pendiente no entra a ventas efectivas y un fiado pagado si", () => {
  const pendingFiadoOrder = createOrderFixture({
    orderId: "order-pending",
    orderCode: "WEB-000001",
    total: 10000,
    isFiado: true,
    fiadoStatus: "pending",
    fiadoObservation: "Paga manana",
  });
  const paidFiadoOrder = createOrderFixture({
    orderId: "order-paid",
    orderCode: "WEB-000002",
    total: 20000,
    isFiado: true,
    fiadoStatus: "paid",
    fiadoObservation: "Ya pago",
  });
  const regularOrder = createOrderFixture({
    orderId: "order-regular",
    orderCode: "WEB-000003",
    total: 30000,
  });

  const summary = getOrdersMetricsSummary([
    pendingFiadoOrder,
    paidFiadoOrder,
    regularOrder,
  ]);

  assert.equal(isPendingFiadoOrder(pendingFiadoOrder), true);
  assert.equal(summary.pendingFiadoCount, 1);
  assert.equal(summary.deliveredRevenue, 50000);
  assert.equal(summary.activeRevenue, 50000);
  assert.equal(summary.referenceDayRevenue, 50000);
  assert.equal(summary.averageTicket, 25000);
});
