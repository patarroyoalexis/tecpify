/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  getBusinessAccessLevel,
  canAccessBusiness,
} = loadTsModule("lib/auth/business-access.ts");
const {
  LEGACY_BUSINESS_OWNERSHIP_STRATEGY,
  resolveLegacyBusinessOwnershipState,
} = loadTsModule("lib/auth/legacy-business-access.ts");
const { createOrdersRouteHandlers } = loadTsModule("app/api/orders/route.ts");
const {
  createLegacyBusinessRemediationRequestRouteHandlers,
} = loadTsModule("app/api/businesses/legacy-remediation/request/route.ts");
const {
  createLegacyBusinessRemediationClaimRouteHandlers,
} = loadTsModule("app/api/businesses/legacy-remediation/claim/route.ts");

const OWNER_ID = "user-owner";
const NON_OWNER_ID = "user-other";

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createRemediationRecord(overrides = {}) {
  return {
    businessId: "biz-legacy",
    businessSlug: "legacy-shop",
    businessName: "Legacy Shop",
    remediationStatus: "ownerless_requested",
    accessStatus: "inaccessible",
    requestedAt: "2026-03-26T15:00:00.000Z",
    ...overrides,
  };
}

test("legacy remediation: ownerless queda bloqueado en acceso privado hasta persistir owner real", () => {
  assert.equal(LEGACY_BUSINESS_OWNERSHIP_STRATEGY.mode, "audited_claim_before_access");

  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ ownerUserId: null }),
    {
      remediationStatus: "ownerless_unassigned",
      accessStatus: "inaccessible",
      isRemediated: false,
      isAccessible: false,
    },
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: "biz-legacy",
        businessSlug: "legacy-shop",
        ownerUserId: null,
      },
      OWNER_ID,
    ),
    null,
  );
  assert.equal(
    canAccessBusiness(OWNER_ID, {
      businessId: "biz-legacy",
      businessSlug: "legacy-shop",
      ownerUserId: null,
    }),
    false,
  );
});

test("legacy remediation: ownerless sigue bloqueado en flujo sensible mientras no haya owner real", async () => {
  const handlers = createOrdersRouteHandlers({
    normalizeBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async () => {
      throw new Error("requireBusinessApiContext no debe usarse en POST");
    },
    getOrdersByBusinessIdFromDatabase: async () => [],
    createOrderInDatabase: async () => {
      throw new Error(
        'Business "legacy-shop" is blocked until it has a real owner in created_by_user_id.',
      );
    },
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/orders", "POST", {
      businessSlug: "legacy-shop",
      customerName: "Ana Perez",
      customerWhatsApp: "3001234567",
      deliveryType: "domicilio",
      deliveryAddress: "Calle 1 # 2-3",
      paymentMethod: "Nequi",
      products: [{ productId: "prod-1", name: "Hamburguesa", quantity: 1, unitPrice: 15000 }],
      total: 15000,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.match(body.error, /blocked until it has a real owner/i);
});

test("legacy remediation: solicitar remediacion registra ownerless -> requested y deja evidencia operativa", async () => {
  const handlers = createLegacyBusinessRemediationRequestRouteHandlers({
    requireAuthenticatedApiUser: async () => ({
      ok: true,
      user: {
        userId: OWNER_ID,
        email: "owner@example.com",
        user: { id: OWNER_ID, email: "owner@example.com" },
      },
    }),
    requestLegacyBusinessOwnershipRemediation: async () =>
      createRemediationRecord(),
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/businesses/legacy-remediation/request", "POST", {
      businessSlug: "legacy-shop",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.remediation.businessSlug, "legacy-shop");
  assert.equal(body.remediation.remediationStatus, "ownerless_requested");
  assert.equal(body.remediation.accessStatus, "inaccessible");
});

test("legacy remediation: claim exitoso persiste ownerless -> owned y devuelve negocio remediado", async () => {
  const handlers = createLegacyBusinessRemediationClaimRouteHandlers({
    requireAuthenticatedApiUser: async () => ({
      ok: true,
      user: {
        userId: OWNER_ID,
        email: "owner@example.com",
        user: { id: OWNER_ID, email: "owner@example.com" },
      },
    }),
    claimLegacyBusinessOwnershipRemediation: async () => ({
      id: "biz-legacy",
      slug: "legacy-shop",
      name: "Legacy Shop",
      createdAt: "2026-03-20T14:00:00.000Z",
      updatedAt: "2026-03-26T15:10:00.000Z",
      createdByUserId: OWNER_ID,
    }),
  });

  const response = await handlers.POST(
    createJsonRequest("http://localhost/api/businesses/legacy-remediation/claim", "POST", {
      businessSlug: "legacy-shop",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.business.slug, "legacy-shop");
  assert.equal(body.business.createdByUserId, OWNER_ID);
});

test("legacy remediation: negocio remediado queda accesible para el owner correcto", () => {
  assert.deepEqual(
    resolveLegacyBusinessOwnershipState({ ownerUserId: OWNER_ID }),
    {
      remediationStatus: "remediated",
      accessStatus: "accessible",
      isRemediated: true,
      isAccessible: true,
    },
  );
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: "biz-legacy",
        businessSlug: "legacy-shop",
        ownerUserId: OWNER_ID,
      },
      OWNER_ID,
    ),
    "owned",
  );
});

test("legacy remediation: negocio remediado no queda accesible para un usuario ajeno", () => {
  assert.equal(
    getBusinessAccessLevel(
      {
        businessId: "biz-legacy",
        businessSlug: "legacy-shop",
        ownerUserId: OWNER_ID,
      },
      NON_OWNER_ID,
    ),
    null,
  );
  assert.equal(
    canAccessBusiness(NON_OWNER_ID, {
      businessId: "biz-legacy",
      businessSlug: "legacy-shop",
      ownerUserId: OWNER_ID,
    }),
    false,
  );
});

test("legacy remediation: la migracion bloquea regresiones que vuelvan a aceptar ownerless como caso operativo", () => {
  const migrationSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260326_add_legacy_business_ownership_remediation.sql",
    ),
    "utf8",
  );

  assert.match(
    migrationSource,
    /insert into public\.legacy_business_ownership_remediations \(business_id, remediation_status\)\s+select businesses\.id, 'ownerless_unassigned'/i,
    "Los negocios legacy existentes deben quedar inventariados como ownerless_unassigned.",
  );
  assert.match(
    migrationSource,
    /raise exception 'legacy businesses require a claimable remediation state before assigning created_by_user_id'/i,
    "La base debe bloquear la asignacion legacy sin estado claimable.",
  );
  assert.match(
    migrationSource,
    /raise exception 'business owner reassignment is not supported for the MVP'/i,
    "La base debe bloquear reasignaciones silenciosas de ownership.",
  );
  assert.match(
    migrationSource,
    /update public\.businesses\s+set created_by_user_id = auth\.uid\(\)/i,
    "El claim debe persistir el owner real directamente en businesses.created_by_user_id.",
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.grant_legacy_business_owner_claim\(text, text\)\s+from public, anon, authenticated;/i,
    "La habilitacion controlada del claim no debe quedar expuesta al runtime autenticado normal.",
  );
});
