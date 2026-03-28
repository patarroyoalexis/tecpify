/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const { PAYMENT_METHODS } = loadTsModule("types/orders.ts");
const { isValidPaymentMethod } = loadTsModule("lib/orders/mappers.ts");
const { createBusinessesRouteHandlers } = loadTsModule("app/api/businesses/route.ts");
const {
  DEFAULT_TRANSFER_INSTRUCTIONS,
  normalizeTransferInstructions,
  resolveTransferInstructions,
} = loadTsModule("lib/businesses/transfer-instructions.ts");
const { buildPaymentProofWhatsAppMessage } = loadTsModule("lib/whatsapp.ts");

const BUSINESS_ID = "0f9f5d8d-1234-4f6b-8f16-6e16b14ac101";
const OWNER_ID = "user-owner";
const repoRoot = process.cwd();

function createJsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("payment methods: Transferencia queda como unico metodo generico de transferencias", () => {
  assert.equal(PAYMENT_METHODS.includes("Transferencia"), true);
  assert.equal(PAYMENT_METHODS.includes("Nequi"), false);
  assert.equal(isValidPaymentMethod("Transferencia"), true);
  assert.equal(isValidPaymentMethod("Nequi"), false);
});

test("transfer instructions: resuelven el texto guardado o el fallback oficial", () => {
  assert.equal(resolveTransferInstructions(null), DEFAULT_TRANSFER_INSTRUCTIONS);
  assert.equal(resolveTransferInstructions("   "), DEFAULT_TRANSFER_INSTRUCTIONS);
  assert.equal(
    normalizeTransferInstructions("  Transferir a Nequi 3001234567 \r\n  Enviar comprobante  "),
    "Transferir a Nequi 3001234567\nEnviar comprobante",
  );
  assert.equal(
    resolveTransferInstructions("  Transferir a cuenta Bancolombia 123  "),
    "Transferir a cuenta Bancolombia 123",
  );
});

test("whatsapp: el mensaje usa datos reales del pedido y las instrucciones configuradas", () => {
  const message = buildPaymentProofWhatsAppMessage({
    businessName: "Tecpify Demo",
    customerName: "Ana Perez",
    orderCode: "WEB-123456",
    total: 32500,
    transferInstructions: "Transferir a Nequi 3001234567 a nombre de Tecpify Demo",
    acceptsCash: true,
    acceptsTransfer: true,
    acceptsCard: true,
    allowsFiado: false,
  });

  assert.match(message, /Hola Ana Perez\./);
  assert.match(message, /Te escribimos de Tecpify Demo\./);
  assert.match(message, /Codigo del pedido: WEB-123456\./);
  assert.match(message, /Total del pedido: \$\s?32\.500/i);
  assert.match(message, /Transferir a Nequi 3001234567/i);
  assert.match(message, /envianos el comprobante por este medio/i);
  assert.equal((message.match(/comprobante/gi) ?? []).length, 1);
  assert.doesNotMatch(message, /undefined|null/);
});

test("businesses api: PATCH guarda instrucciones de transferencia del owner autenticado", async () => {
  let receivedUpdatePayload = null;
  let receivedBusinessId = null;

  const handlers = createBusinessesRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: BUSINESS_ID,
        businessSlug,
        businessName: "Mi tienda",
        transferInstructions: null,
        acceptsCash: true,
        acceptsTransfer: true,
        acceptsCard: true,
        allowsFiado: false,
        createdByUserId: OWNER_ID,
        accessLevel: "owned",
        user: {
          userId: OWNER_ID,
          email: "owner@example.com",
          user: { id: OWNER_ID, email: "owner@example.com" },
        },
      },
    }),
    requireAuthenticatedApiUser: async () => {
      throw new Error("requireAuthenticatedApiUser no debe usarse en PATCH");
    },
    createServerSupabaseAuthClient: async () => ({
      from(table) {
        assert.equal(table, "businesses");
        return {
          update(payload) {
            receivedUpdatePayload = payload;

            return {
              eq(column, value) {
                assert.equal(column, "id");
                receivedBusinessId = value;

                return {
                  select() {
                    return {
                      async single() {
                        return {
                          data: {
                            id: BUSINESS_ID,
                            slug: "mi-tienda",
                            name: "Mi tienda",
                            transfer_instructions: payload.transfer_instructions,
                            accepts_cash: payload.accepts_cash,
                            accepts_transfer: payload.accepts_transfer,
                            accepts_card: payload.accepts_card,
                            allows_fiado: payload.allows_fiado,
                            created_at: "2026-03-28T12:00:00.000Z",
                            updated_at: "2026-03-28T12:05:00.000Z",
                            created_by_user_id: OWNER_ID,
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => BUSINESS_ID,
    getNow: () => "2026-03-28T12:05:00.000Z",
  });

  const response = await handlers.PATCH(
    createJsonRequest("http://localhost/api/businesses", "PATCH", {
      businessSlug: " Mi-Tienda ",
      transferInstructions:
        " Transferir a Nequi 3001234567 a nombre de Tecpify Demo y enviar comprobante por WhatsApp ",
      acceptsCash: true,
      acceptsTransfer: true,
      acceptsCard: true,
      allowsFiado: false,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedBusinessId, BUSINESS_ID);
  assert.deepEqual(receivedUpdatePayload, {
    transfer_instructions:
      "Transferir a Nequi 3001234567 a nombre de Tecpify Demo y enviar comprobante por WhatsApp",
    accepts_cash: true,
    accepts_transfer: true,
    accepts_card: true,
    allows_fiado: false,
    updated_at: "2026-03-28T12:05:00.000Z",
  });
  assert.equal(
    body.business.transferInstructions,
    "Transferir a Nequi 3001234567 a nombre de Tecpify Demo y enviar comprobante por WhatsApp",
  );
  assert.equal(body.business.acceptsCash, true);
  assert.equal(body.business.acceptsTransfer, true);
  assert.equal(body.business.acceptsCard, true);
  assert.equal(body.business.allowsFiado, false);
});

test("businesses api: PATCH permite vaciar instrucciones y persiste null", async () => {
  const handlers = createBusinessesRouteHandlers({
    requireBusinessSlug: (value) => value.trim().toLowerCase(),
    requireBusinessApiContext: async (businessSlug) => ({
      ok: true,
      context: {
        businessId: BUSINESS_ID,
        businessSlug,
        businessName: "Mi tienda",
        transferInstructions: "Transferir a cuenta 123",
        acceptsCash: true,
        acceptsTransfer: true,
        acceptsCard: true,
        allowsFiado: false,
        createdByUserId: OWNER_ID,
        accessLevel: "owned",
        user: {
          userId: OWNER_ID,
          email: "owner@example.com",
          user: { id: OWNER_ID, email: "owner@example.com" },
        },
      },
    }),
    requireAuthenticatedApiUser: async () => {
      throw new Error("requireAuthenticatedApiUser no debe usarse en PATCH");
    },
    createServerSupabaseAuthClient: async () => ({
      from() {
        return {
          update(payload) {
            return {
              eq() {
                return {
                  select() {
                    return {
                      async single() {
                        return {
                          data: {
                            id: BUSINESS_ID,
                            slug: "mi-tienda",
                            name: "Mi tienda",
                            transfer_instructions: payload.transfer_instructions,
                            accepts_cash: payload.accepts_cash,
                            accepts_transfer: payload.accepts_transfer,
                            accepts_card: payload.accepts_card,
                            allows_fiado: payload.allows_fiado,
                            created_at: "2026-03-28T12:00:00.000Z",
                            updated_at: "2026-03-28T12:06:00.000Z",
                            created_by_user_id: OWNER_ID,
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    }),
    debugError: () => {},
    debugLog: () => {},
    createBusinessId: () => BUSINESS_ID,
    getNow: () => "2026-03-28T12:06:00.000Z",
  });

  const response = await handlers.PATCH(
    createJsonRequest("http://localhost/api/businesses", "PATCH", {
      businessSlug: "mi-tienda",
      transferInstructions: "   ",
      acceptsCash: true,
      acceptsTransfer: true,
      acceptsCard: true,
      allowsFiado: false,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.business.transferInstructions, null);
});

test("business transfer migration: la definicion efectiva agrega el campo y el update protegido", () => {
  const migrationSource = fs.readFileSync(
    path.join(
      repoRoot,
      "supabase",
      "migrations",
      "20260328002_simplify_transfer_payment_and_business_transfer_instructions.sql",
    ),
    "utf8",
  );

  assert.match(migrationSource, /add column if not exists transfer_instructions text/i);
  assert.match(migrationSource, /grant update on public\.businesses to authenticated/i);
  assert.match(migrationSource, /create policy "authenticated can update owned businesses"/i);
  assert.match(migrationSource, /payment_method = 'Transferencia'/i);
});
