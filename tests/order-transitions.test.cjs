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
  getOrderStateUpdateError,
  resolveAuthoritativeOrderStatePatch,
} = loadTsModule("lib/orders/state-rules.ts");
const {
  getCancelOrderError,
  getReactivateOrderError,
} = loadTsModule("lib/orders/cancellation-rules.ts");
const {
  ORDER_STATUS_VISUALS,
} = loadTsModule("lib/orders/status-system.ts");

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
      status: "nuevo",
      paymentStatus: "pendiente",
    },
    {
      status: "confirmado",
    },
  );

  assert.match(error, /pago no est[eé] verificado/i);
});

test("dominio: permite verificar pago y avanzar en la misma actualizacion", () => {
  const error = getOrderUpdateTransitionError(
    {
      deliveryType: "domicilio",
      status: "nuevo",
      paymentStatus: "pendiente",
    },
    {
      status: "confirmado",
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
      paymentMethod: "Transferencia",
      paymentStatus: "pendiente",
      status: "nuevo",
    },
    {
      paymentMethod: "Efectivo",
    },
  );

  assert.deepEqual(resolvedStatePatch.nextState, {
    deliveryType: "domicilio",
    paymentMethod: "Efectivo",
    paymentStatus: "verificado",
    status: "nuevo",
  });
  assert.deepEqual(resolvedStatePatch.changedFields.sort(), ["paymentMethod", "paymentStatus"]);
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

test("dominio: cancelar exige motivo obligatorio y detalle cuando el motivo es otro", async (t) => {
  await t.test("permite cancelar desde Nuevo", () => {
    const error = getCancelOrderError(
      { status: "nuevo" },
      {
        status: "cancelado",
        cancellationReason: "cliente_canceló",
      },
      ["status", "cancellationReason"],
    );

    assert.equal(error, null);
  });

  await t.test("permite cancelar desde Preparación", () => {
    const error = getCancelOrderError(
      { status: "en preparación" },
      {
        status: "cancelado",
        cancellationReason: "producto_no_disponible",
      },
      ["status", "cancellationReason"],
    );

    assert.equal(error, null);
  });

  await t.test("rechaza cancelar un pedido entregado", () => {
    const error = getCancelOrderError(
      { status: "entregado" },
      {
        status: "cancelado",
        cancellationReason: "cliente_canceló",
      },
      ["status", "cancellationReason"],
    );

    assert.match(error, /ya fue entregado/i);
  });

  await t.test("rechaza cuando falta el motivo", () => {
    const error = getCancelOrderError(
      { status: "nuevo" },
      {
        status: "cancelado",
      },
      ["status"],
    );

    assert.match(error, /motivo de cancelación válido/i);
  });

  await t.test('rechaza "otro" sin detalle', () => {
    const error = getCancelOrderError(
      { status: "nuevo" },
      {
        status: "cancelado",
        cancellationReason: "otro",
      },
      ["status", "cancellationReason"],
    );

    assert.match(error, /debes detallar/i);
  });
});

test("dominio: reactivar exige estado previo exacto y falla cerrado si no existe", async (t) => {
  await t.test("permite reactivar un cancelado con estado previo valido", () => {
    const error = getReactivateOrderError(
      {
        status: "cancelado",
        previousStatusBeforeCancellation: "listo",
      },
      {
        reactivateCancelledOrder: true,
      },
      ["reactivateCancelledOrder"],
    );

    assert.equal(error, null);
  });

  await t.test("rechaza reactivar si no existe estado previo valido", () => {
    const error = getReactivateOrderError(
      {
        status: "cancelado",
        previousStatusBeforeCancellation: null,
      },
      {
        reactivateCancelledOrder: true,
      },
      ["reactivateCancelledOrder"],
    );

    assert.match(error, /estado previo válido/i);
  });
});

test("dominio: cancelar no entra por el patch secuencial generico", () => {
  const error = getOrderStateUpdateError(
    {
      deliveryType: "domicilio",
      paymentMethod: "Transferencia",
      paymentStatus: "verificado",
      status: "nuevo",
    },
    {
      status: "cancelado",
    },
  );

  assert.match(error, /flujo de cancelacion con motivo obligatorio/i);
});

test("ui: la semantica de color de estados queda centralizada", () => {
  const actualStatuses = Object.keys(ORDER_STATUS_VISUALS).sort((left, right) =>
    left.localeCompare(right, "es"),
  );
  const expectedStatuses = [
    "cancelado",
    "confirmado",
    "entregado",
    "en preparación",
    "listo",
    "nuevo",
  ].sort((left, right) => left.localeCompare(right, "es"));

  assert.deepEqual(actualStatuses, expectedStatuses);
  assert.match(ORDER_STATUS_VISUALS.nuevo.boardHeaderClassName, /sky/i);
  assert.match(ORDER_STATUS_VISUALS.confirmado.boardHeaderClassName, /(amber|orange)/i);
  assert.match(ORDER_STATUS_VISUALS["en preparación"].boardHeaderClassName, /violet/i);
  assert.match(ORDER_STATUS_VISUALS.listo.boardHeaderClassName, /emerald/i);
  assert.match(ORDER_STATUS_VISUALS.entregado.boardHeaderClassName, /teal/i);
  assert.match(ORDER_STATUS_VISUALS.cancelado.boardHeaderClassName, /rose/i);
});
