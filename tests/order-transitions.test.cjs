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
      deliveryType: "domicilio",
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
      deliveryType: "domicilio",
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
    deliveryType: "domicilio",
    paymentMethod: "Efectivo",
    paymentStatus: "pendiente",
    status: "confirmado",
  });

  assert.match(error, /efectivo o contra entrega/i);
});

test("dominio: contra entrega solo se permite a domicilio tambien en servidor", () => {
  const error = getOrderStateConsistencyError({
    deliveryType: "recogida en tienda",
    paymentMethod: "Contra entrega",
    paymentStatus: "verificado",
    status: "confirmado",
  });

  assert.match(error, /Contra entrega solo se permite en pedidos a domicilio/i);
});

test("dominio: cambiar a efectivo deriva confirmacion server-side sin dejar el pedido incoherente", () => {
  const resolvedStatePatch = resolveAuthoritativeOrderStatePatch(
    {
      deliveryType: "domicilio",
      paymentMethod: "Nequi",
      paymentStatus: "pendiente",
      status: "pendiente de pago",
    },
    {
      paymentMethod: "Efectivo",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    deliveryType: "domicilio",
    paymentMethod: "Efectivo",
    paymentStatus: "verificado",
    status: "confirmado",
  });
  assert.deepEqual(
    resolvedStatePatch.changedFields.sort(),
    ["paymentMethod", "paymentStatus", "status"],
  );
});

test("dominio: cambiar un pedido contra entrega a recogida en tienda se rechaza server-side", () => {
  const error = (() => {
    try {
      resolveAuthoritativeOrderStatePatch(
        {
          deliveryType: "domicilio",
          paymentMethod: "Contra entrega",
          paymentStatus: "verificado",
          status: "confirmado",
        },
        {
          deliveryType: "recogida en tienda",
        },
      );
      return null;
    } catch (patchError) {
      return patchError instanceof Error ? patchError.message : String(patchError);
    }
  })();

  assert.match(error, /Contra entrega solo se permite en pedidos a domicilio/i);
});
