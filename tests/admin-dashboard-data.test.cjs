/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { buildAdminDashboardSnapshot } = loadTsModule("lib/data/admin-dashboard.ts");

function getKpi(snapshot, key) {
  const kpi = snapshot.kpis.find((candidate) => candidate.key === key);
  assert.ok(kpi, `No encontramos el KPI ${key}.`);
  return kpi;
}

function getFunnelStep(snapshot, key) {
  const step = snapshot.funnel.find((candidate) => candidate.key === key);
  assert.ok(step, `No encontramos el funnel step ${key}.`);
  return step;
}

test("admin dashboard data: la base vacia devuelve estructura estable y estados honestos", () => {
  const snapshot = buildAdminDashboardSnapshot(
    {
      profiles: [],
      businesses: [],
      products: [],
      orders: [],
    },
    new Date("2026-03-30T12:00:00.000Z"),
  );

  assert.equal(getKpi(snapshot, "total_businesses").value, 0);
  assert.equal(getKpi(snapshot, "platform_gmv_total").value, 0);
  assert.equal(snapshot.charts.recentBusinesses.points.length, 14);
  assert.equal(snapshot.charts.ordersByDay.points.length, 14);
  assert.equal(snapshot.charts.gmvByDay.points.length, 14);
  assert.equal(snapshot.tables.recentBusinesses.length, 0);
  assert.equal(snapshot.tables.incompleteActivationBusinesses.length, 0);
  assert.equal(getFunnelStep(snapshot, "account_created").value, 0);
  assert.equal(getFunnelStep(snapshot, "first_order_received").value, 0);
  assert.equal(snapshot.notes.length, 3);
});

test("admin dashboard data: el snapshot global agrega KPIs reales y no inventa pasos del funnel", () => {
  const snapshot = buildAdminDashboardSnapshot(
    {
      profiles: [
        {
          userId: "owner-1",
          role: "business_owner",
          createdAt: "2026-03-20T12:00:00.000Z",
          updatedAt: "2026-03-20T12:00:00.000Z",
        },
        {
          userId: "owner-2",
          role: "business_owner",
          createdAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
        },
        {
          userId: "owner-3",
          role: "business_owner",
          createdAt: "2026-03-22T12:00:00.000Z",
          updatedAt: "2026-03-22T12:00:00.000Z",
        },
        {
          userId: "internal-admin",
          role: "platform_admin",
          createdAt: "2026-03-19T12:00:00.000Z",
          updatedAt: "2026-03-19T12:00:00.000Z",
        },
      ],
      businesses: [
        {
          businessId: "business-1",
          businessSlug: "sin-productos",
          businessName: "Sin productos",
          createdByUserId: "owner-1",
          createdAt: "2026-03-29T12:00:00.000Z",
          updatedAt: "2026-03-29T12:00:00.000Z",
        },
        {
          businessId: "business-2",
          businessSlug: "catalogo-inactivo",
          businessName: "Catalogo inactivo",
          createdByUserId: "owner-2",
          createdAt: "2026-03-28T12:00:00.000Z",
          updatedAt: "2026-03-28T12:00:00.000Z",
        },
        {
          businessId: "business-3",
          businessSlug: "ya-vendio",
          businessName: "Ya vendio",
          createdByUserId: "owner-3",
          createdAt: "2026-03-27T12:00:00.000Z",
          updatedAt: "2026-03-30T08:00:00.000Z",
        },
      ],
      products: [
        {
          productId: "product-1",
          businessId: "business-2",
          isAvailable: false,
          createdAt: "2026-03-28T14:00:00.000Z",
          updatedAt: "2026-03-28T14:00:00.000Z",
        },
        {
          productId: "product-2",
          businessId: "business-3",
          isAvailable: true,
          createdAt: "2026-03-27T15:00:00.000Z",
          updatedAt: "2026-03-30T08:30:00.000Z",
        },
      ],
      orders: [
        {
          orderId: "order-1",
          businessId: "business-3",
          total: 30_000,
          status: "entregado",
          isFiado: false,
          fiadoStatus: null,
          createdAt: "2026-03-30T09:00:00.000Z",
          updatedAt: "2026-03-30T09:00:00.000Z",
        },
        {
          orderId: "order-2",
          businessId: "business-3",
          total: 20_000,
          status: "entregado",
          isFiado: true,
          fiadoStatus: "pending",
          createdAt: "2026-03-30T10:00:00.000Z",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
        {
          orderId: "order-3",
          businessId: "business-3",
          total: 10_000,
          status: "cancelado",
          isFiado: false,
          fiadoStatus: null,
          createdAt: "2026-03-30T11:00:00.000Z",
          updatedAt: "2026-03-30T11:00:00.000Z",
        },
      ],
    },
    new Date("2026-03-30T12:00:00.000Z"),
  );

  assert.equal(getKpi(snapshot, "total_businesses").value, 3);
  assert.equal(getKpi(snapshot, "businesses_with_published_catalog").value, 1);
  assert.equal(getKpi(snapshot, "businesses_with_orders").value, 1);
  assert.equal(getKpi(snapshot, "total_platform_orders").value, 3);
  assert.equal(
    getKpi(snapshot, "platform_gmv_total").value,
    30_000,
    "El GMV no debe contar cancelados ni fiados pendientes.",
  );

  assert.equal(getFunnelStep(snapshot, "account_created").value, 3);
  assert.equal(getFunnelStep(snapshot, "business_created").value, 3);
  assert.equal(getFunnelStep(snapshot, "first_product_loaded").value, 2);
  assert.equal(getFunnelStep(snapshot, "published_catalog").value, 1);
  assert.equal(getFunnelStep(snapshot, "first_order_received").value, 1);
  assert.match(
    getFunnelStep(snapshot, "account_created").measurement,
    /no cuenta `customer` ni admins internos sin negocio/i,
  );

  assert.equal(snapshot.tables.businessesWithoutProducts.length, 1);
  assert.equal(snapshot.tables.businessesWithoutProducts[0].businessSlug, "sin-productos");
  assert.equal(snapshot.tables.businessesWithoutOrders.length, 2);
  assert.equal(snapshot.tables.incompleteActivationBusinesses.length, 2);
  assert.equal(snapshot.tables.recentBusinesses[0].businessSlug, "sin-productos");
  assert.equal(snapshot.tables.recentActivityBusinesses[0].businessSlug, "ya-vendio");
  assert.equal(snapshot.tables.recentActivityBusinesses[0].activationStage.key, "first_order_received");

  const gmvPoint = snapshot.charts.gmvByDay.points.find((point) => point.key === "2026-03-30");
  assert.ok(gmvPoint, "La serie de GMV debe incluir el dia con ventas efectivas.");
  assert.equal(gmvPoint.value, 30_000);
});
