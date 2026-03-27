/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const migrationSource = readFile(
  "supabase/migrations/20260326002_enforce_order_payment_rules_in_db.sql",
);
const stateRulesSource = readFile("lib/orders/state-rules.ts");
const ordersServerSource = readFile("lib/data/orders-server.ts");
const paymentHelpersSource = readFile("components/dashboard/payment-helpers.ts");

test("db guardrails: Supabase deriva el estado inicial de pago en inserts directos", () => {
  assert.match(
    migrationSource,
    /create or replace function public\.orders_enforce_authoritative_payment_insert\(\)/i,
    "La base debe tener un trigger dedicado para derivar el estado inicial de pago.",
  );
  assert.match(
    migrationSource,
    /new\.payment_status := 'verificado';[\s\S]*new\.status := 'confirmado';/i,
    "Los pagos cash deben quedar derivados como verificados y confirmados desde DB.",
  );
  assert.match(
    migrationSource,
    /new\.payment_status := 'pendiente';[\s\S]*new\.status := 'pendiente de pago';/i,
    "Los pagos digitales deben quedar derivados como pendientes desde DB.",
  );
  assert.match(
    migrationSource,
    /create trigger orders_enforce_authoritative_payment_before_insert/i,
    "El trigger before insert debe quedar cableado sobre public.orders.",
  );
});

test("db guardrails: Supabase rechaza updates directos incoherentes y contra entrega invalida", () => {
  assert.match(
    migrationSource,
    /create or replace function public\.orders_enforce_authoritative_payment_update\(\)/i,
    "La base debe tener un trigger dedicado para validar updates directos en orders.",
  );
  assert.match(
    migrationSource,
    /Contra entrega solo se permite en pedidos a domicilio\./i,
    "La restriccion de Contra entrega debe existir en DB y no solo en UI.",
  );
  assert.match(
    migrationSource,
    /Solo puedes mover el pedido al siguiente paso permitido del flujo\./i,
    "La base debe bloquear updates directos que salten el flujo permitido.",
  );
  assert.match(
    migrationSource,
    /No puedes avanzar el pedido mientras el pago no este verificado\./i,
    "La base debe rechazar estados operativos con pago no verificado.",
  );
  assert.match(
    migrationSource,
    /create trigger orders_enforce_authoritative_payment_before_update/i,
    "El trigger before update debe quedar cableado sobre public.orders.",
  );
});

test("db guardrails: las policies de orders obligan el blindaje de pago en insert y update", () => {
  assert.match(
    migrationSource,
    /create or replace function public\.orders_insert_request_is_valid\(/i,
    "La base debe exponer una validacion reutilizable para el request base del insert.",
  );
  assert.match(
    migrationSource,
    /create policy "public can create orders"[\s\S]*to anon[\s\S]*orders_insert_request_is_valid/i,
    "La policy publica de insert debe quedar acotada a anon y validar solo el request base antes del trigger autoritativo.",
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can insert owned orders"[\s\S]*created_by_user_id = auth\.uid\(\)[\s\S]*orders_insert_request_is_valid/i,
    "El insert autenticado debe respetar ownership real y el request base validado en DB.",
  );
  assert.match(
    migrationSource,
    /create policy "authenticated can update accessible orders"[\s\S]*orders_payment_write_is_valid/i,
    "La policy de update debe exigir la validacion de pago en DB.",
  );
});

test("regresion: Contra entrega ya no vive solo en helpers de UI", () => {
  assert.match(
    stateRulesSource,
    /isPaymentMethodAllowedForDeliveryType/,
    "La regla de disponibilidad por deliveryType debe vivir en el nucleo server-side.",
  );
  assert.match(
    paymentHelpersSource,
    /isPaymentMethodAllowedForDeliveryType/,
    "La UI debe reutilizar la regla central y no mantener una copia aislada.",
  );
  assert.match(
    ordersServerSource,
    /getOrderPaymentMethodDeliveryTypeError/,
    "La creacion de pedidos debe validar Contra entrega tambien en servidor.",
  );
});
