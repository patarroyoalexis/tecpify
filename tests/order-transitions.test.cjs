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

  assert.match(error, /pago no este verificado/i);
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
