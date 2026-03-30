/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  canOrderMoveFromNewToConfirmed,
  getOrderFinancialCondition,
  ORDER_FINANCIAL_CONDITION_VISUALS,
} = loadTsModule("lib/orders/payment-gate.ts");
const {
  splitOrdersForOperationalBoard,
} = loadTsModule("lib/orders/board-model.ts");
const {
  ORDER_STATUS_VISUALS,
} = loadTsModule("lib/orders/status-system.ts");

function getOrdersBoardSource() {
  return fs.readFileSync(
    path.join(process.cwd(), "components", "dashboard", "orders-board.tsx"),
    "utf8",
  );
}

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

test("dominio: la compuerta de Nuevo bloquea el avance cuando la condicion financiera no habilita confirmar", async (t) => {
  await t.test("bloquea Nuevo -> Confirmado cuando el pago digital sigue pendiente", () => {
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

    assert.match(error, /condici[oó]n financiera|compuerta/i);
  });

  await t.test("bloquea Nuevo -> Confirmado cuando el pedido ya esta por verificar", () => {
    const error = getOrderStateUpdateError(
      {
        deliveryType: "domicilio",
        paymentMethod: "Transferencia",
        paymentStatus: "no verificado",
        status: "nuevo",
      },
      {
        status: "confirmado",
      },
    );

    assert.match(error, /condici[oó]n financiera|compuerta/i);
  });
});

test("dominio: Nuevo -> Confirmado se habilita solo con la condicion financiera correcta", async (t) => {
  await t.test("permite confirmar cuando paymentStatus = verificado", () => {
    const error = getOrderUpdateTransitionError(
      {
        deliveryType: "domicilio",
        status: "nuevo",
        paymentStatus: "verificado",
      },
      {
        status: "confirmado",
      },
    );

    assert.equal(error, null);
  });

  await t.test("permite confirmar cuando la condicion es contra entrega", () => {
    const error = getOrderStateUpdateError(
      {
        deliveryType: "domicilio",
        paymentMethod: "Contra entrega",
        paymentStatus: "verificado",
        status: "nuevo",
      },
      {
        status: "confirmado",
      },
    );

    assert.equal(error, null);
  });

  await t.test("permite confirmar cuando la condicion es fiado", () => {
    const error = getOrderUpdateTransitionError(
      {
        deliveryType: "domicilio",
        paymentMethod: "Transferencia",
        paymentStatus: "pendiente",
        status: "nuevo",
        isFiado: true,
        fiadoStatus: "pending",
      },
      {
        status: "confirmado",
      },
    );

    assert.equal(error, null);
  });
});

test("dominio: la semantica financiera mantiene fiado visible y separado del pago verificado", async (t) => {
  await t.test("fiado no se degrada a pendiente generico", () => {
    assert.equal(
      getOrderFinancialCondition({
        paymentMethod: "Transferencia",
        paymentStatus: "pendiente",
        isFiado: true,
        fiadoStatus: "pending",
        isReviewed: true,
      }),
      "fiado",
    );
  });

  await t.test("la compuerta reutilizable reconoce verified, contra entrega y fiado", () => {
    assert.equal(
      canOrderMoveFromNewToConfirmed({
        paymentMethod: "Transferencia",
        paymentStatus: "verificado",
        isFiado: false,
        fiadoStatus: null,
      }),
      true,
    );
    assert.equal(
      canOrderMoveFromNewToConfirmed({
        paymentMethod: "Contra entrega",
        paymentStatus: "verificado",
        isFiado: false,
        fiadoStatus: null,
      }),
      true,
    );
    assert.equal(
      canOrderMoveFromNewToConfirmed({
        paymentMethod: "Transferencia",
        paymentStatus: "pendiente",
        isFiado: true,
        fiadoStatus: "pending",
      }),
      true,
    );
    assert.equal(
      canOrderMoveFromNewToConfirmed({
        paymentMethod: "Transferencia",
        paymentStatus: "con novedad",
        isFiado: false,
        fiadoStatus: null,
      }),
      false,
    );
  });
});

test("dominio: marcar pago verificado habilita confirmar y con novedad mantiene el bloqueo", async (t) => {
  await t.test("permite verificar pago y avanzar en la misma actualizacion", () => {
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

  await t.test("con novedad mantiene bloqueado Nuevo -> Confirmado", () => {
    const error = getOrderStateUpdateError(
      {
        deliveryType: "domicilio",
        paymentMethod: "Transferencia",
        paymentStatus: "con novedad",
        status: "nuevo",
      },
      {
        status: "confirmado",
      },
    );

    assert.match(error, /condici[oó]n financiera|compuerta/i);
  });
});

test("dominio: exige regla financiera antes de avanzar el estado operativo", () => {
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

  assert.match(error, /condici[oó]n financiera|compuerta/i);
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

test("ui: la semantica financiera reusable queda centralizada para futuras vistas moviles", () => {
  const actualConditions = Object.keys(ORDER_FINANCIAL_CONDITION_VISUALS).sort((left, right) =>
    left.localeCompare(right, "es"),
  );
  const expectedConditions = [
    "con novedad",
    "contra entrega",
    "fiado",
    "pendiente",
    "por verificar",
    "verificado",
  ].sort((left, right) => left.localeCompare(right, "es"));

  assert.deepEqual(actualConditions, expectedConditions);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS.pendiente.badgeClassName, /slate/i);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS["por verificar"].badgeClassName, /sky/i);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS.verificado.badgeClassName, /emerald/i);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS["con novedad"].badgeClassName, /orange/i);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS["contra entrega"].badgeClassName, /cyan/i);
  assert.match(ORDER_FINANCIAL_CONDITION_VISUALS.fiado.badgeClassName, /amber/i);
});

test("ui: cancelados quedan fuera del flujo principal del board", () => {
  const { cancelledOrders, columns } = splitOrdersForOperationalBoard([
    {
      orderId: "order-1",
      status: "cancelado",
      createdAt: "2026-03-29T12:00:00.000Z",
    },
    {
      orderId: "order-2",
      status: "nuevo",
      createdAt: "2026-03-29T11:00:00.000Z",
    },
    {
      orderId: "order-3",
      status: "confirmado",
      createdAt: "2026-03-29T10:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    cancelledOrders.map((order) => order.orderId),
    ["order-1"],
  );
  assert.deepEqual(
    columns.find((column) => column.status === "nuevo")?.orders.map((order) => order.orderId),
    ["order-2"],
  );
  assert.deepEqual(
    columns.find((column) => column.status === "confirmado")?.orders.map((order) => order.orderId),
    ["order-3"],
  );
  assert.equal(
    columns.some((column) => column.orders.some((order) => order.status === "cancelado")),
    false,
  );
});

test("ui: desktop mantiene el board horizontal solo en viewport desktop", () => {
  const source = getOrdersBoardSource();

  assert.match(source, /function OrdersDesktopBoard/);
  assert.match(source, /data-testid="orders-board-main"/);
  assert.match(source, /min-w-\[1380px\]/);
  assert.match(source, /data-testid="orders-board-cancelled"/);
  assert.match(source, /return <OrdersDesktopBoard \{\.\.\.props\} \/>;/);
});

test("ui: mobile reemplaza el board horizontal por tabs y lista vertical", () => {
  const source = getOrdersBoardSource();

  assert.match(source, /function OrdersMobileBoard/);
  assert.match(source, /MOBILE_MEDIA_QUERY = "\(\max-width: 767px\)"/);
  assert.match(source, /data-testid="orders-mobile-board"/);
  assert.match(source, /data-testid="orders-mobile-nav"/);
  assert.match(source, /grid-cols-5/);
  assert.match(source, /data-testid=\{`orders-mobile-tab-\$\{status\}`\}/);
  assert.match(source, /data-testid=\{`orders-mobile-panel-\$\{activeStatus\}`\}/);
  assert.match(source, /getCompactMobileStatusLabel/);
  assert.doesNotMatch(source, /Operacion movil/);
  assert.doesNotMatch(source, /Tabs por estado y lista vertical/);
  assert.doesNotMatch(source, /Compuerta operativa principal/);
  assert.match(source, /return <OrdersMobileBoard \{\.\.\.props\} \/>;/);
});

test("ui: mobile deja cancelado en una vista secundaria separada del flujo principal", () => {
  const source = getOrdersBoardSource();

  assert.match(source, /data-testid="orders-mobile-cancelled-section"/);
  assert.match(source, /data-testid="orders-mobile-cancelled-toggle"/);
  assert.match(source, /data-testid="orders-mobile-panel-cancelado"/);
  assert.match(source, /Cancelados aparte/);
  assert.match(source, /chevron-up/);
  assert.match(source, /chevron-down/);
  assert.match(source, /defaultMobileStatus = "nuevo"/);
});
