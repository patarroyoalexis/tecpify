/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  getOrderStatusTransitionRule,
  getPaymentStatusTransitionRule,
} = loadTsModule("lib/orders/transitions.ts");
const {
  getOrderUpdateTransitionError,
} = loadTsModule("lib/orders/update-guards.ts");
const {
  getOrderStateConsistencyError,
  resolveAuthoritativeOrderStatePatch,
} = loadTsModule("lib/orders/state-rules.ts");

test("dominio: bloquea saltos de estado y estados finales", async (t) => {
  await t.test("no permite saltar pasos del flujo", () => {
    const result = getOrderStatusTransitionRule({ status: "confirmado" }, "listo");

    assert.equal(result.allowed, false);
    assert.match(result.reason, /siguiente paso permitido/i);
  });

  await t.test("no permite avanzar un pedido finalizado", () => {
    const result = getOrderStatusTransitionRule({ status: "entregado" }, "confirmado");
    const normalizedReason = result.reason.normalize("NFD");

    assert.equal(result.allowed, false);
    assert.ok(normalizedReason.includes("ya termino"));
    assert.ok(normalizedReason.includes("su flujo"));
  });
});

test("dominio: exige pago verificado para avanzar el estado operativo", () => {
  const error = getOrderUpdateTransitionError(
    {
      status: "pendiente de pago",
      paymentStatus: "pendiente",
    },
    {
      status: "pago por verificar",
    },
  );

  assert.match(error, /(pago por verificar|pago no este verificado)/i);
});

test("dominio: permite verificar pago y avanzar en la misma actualizacion", () => {
  const error = getOrderUpdateTransitionError(
    {
      status: "pendiente de pago",
      paymentStatus: "pendiente",
    },
    {
      status: "pago por verificar",
      paymentStatus: "verificado",
    },
  );

  assert.equal(error, null);
});

test("dominio: cambios de pago verificado mantienen confirmacion explicita", () => {
  const result = getPaymentStatusTransitionRule(
    {
      paymentStatus: "verificado",
    },
    "no verificado",
  );

  assert.equal(result.allowed, true);
  assert.match(result.requiresConfirmation, /confirma/i);
});

test("dominio: pagos no digitales no aceptan estados de pago pendientes", () => {
  const error = getOrderStateConsistencyError({
    paymentMethod: "Efectivo",
    paymentStatus: "pendiente",
    status: "confirmado",
  });

  assert.match(error, /efectivo o contra entrega/i);
});

test("dominio: cambiar a efectivo deriva confirmacion server-side sin dejar el pedido incoherente", () => {
  const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
    {
      paymentMethod: "Nequi",
      paymentStatus: "pendiente",
      status: "pendiente de pago",
    },
    {
      paymentMethod: "Efectivo",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    paymentMethod: "Efectivo",
    paymentStatus: "verificado",
    status: "confirmado",
  });
  assert.deepEqual(
    resolvedStatePatch.changedFields.sort(),
    ["paymentMethod", "paymentStatus", "status"],
  );
});
