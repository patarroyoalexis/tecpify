/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("storefront checkout layout: conserva header comercial, progreso y resumen sticky", () => {
  const source = read("components/storefront/order-wizard.tsx");

  assert.match(
    source,
    /Pide en menos de 1 minuto/,
    "El storefront publico debe conservar un header comercial con propuesta de valor clara.",
  );
  assert.match(
    source,
    /Tus datos[\s\S]*Productos[\s\S]*Entrega y pago[\s\S]*Confirmacion/,
    "La barra de progreso debe mantener los 4 pasos del checkout publico.",
  );
  assert.match(
    source,
    /lg:grid-cols-\[minmax\(0,1\.65fr\)_minmax\(320px,0\.95fr\)\]/,
    "El layout desktop debe seguir usando dos columnas tipo checkout con resumen lateral.",
  );
  assert.match(
    source,
    /lg:sticky lg:top-6/,
    "El resumen lateral debe permanecer sticky en desktop.",
  );
  assert.match(
    source,
    /Costo de entrega/,
    "El resumen debe seguir mostrando el estado del costo de entrega de forma visible.",
  );
  assert.match(
    source,
    /Confirmar pedido/,
    "El CTA principal del resumen debe seguir orientado al cierre del pedido.",
  );
  assert.match(
    source,
    /\/legal\/privacidad/,
    "La tarjeta de autorizacion debe mantener acceso visible a la politica de tratamiento.",
  );
  assert.match(
    source,
    /getMobileCtaLabel/,
    "El storefront debe conservar una capa de CTA mobile orientada al avance del checkout.",
  );
  assert.match(
    source,
    /Ir a productos/,
    "Mobile debe permitir llegar mas rapido al bloque protagonista de productos.",
  );
  assert.match(
    source,
    /fixed inset-x-0 bottom-0[\s\S]*lg:hidden/,
    "La experiencia mobile debe mantener una barra inferior visible con total y accion principal.",
  );
  assert.match(
    source,
    /sectionId=\"storefront-products-section\"/,
    "El bloque de productos debe seguir teniendo un ancla clara para el salto rapido mobile.",
  );
});
