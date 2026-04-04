/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("storefront checkout layout: compacta header y resumen sticky sin tocar el flujo", () => {
  const source = read("components/storefront/order-wizard.tsx");

  assert.match(
    source,
    /Haz tu pedido facil y rapido/,
    "El storefront publico debe abrir con un encabezado breve orientado a compra.",
  );
  assert.match(
    source,
    /Pide directo aqui[\s\S]*\{business\.name\}/,
    "El encabezado debe dar protagonismo directo al nombre del negocio.",
  );
  assert.match(
    source,
    /\[text-wrap:balance\][\s\S]*lg:text-\[3\.45rem\]/,
    "El nombre del negocio debe soportar lectura elegante en 1 o 2 lineas sin truncarse agresivamente.",
  );
  assert.match(
    source,
    /Tus datos[\s\S]*Productos[\s\S]*Entrega y pago[\s\S]*Confirmacion/,
    "La barra de progreso debe mantener los 4 pasos del checkout publico.",
  );
  const stickyIndex = source.indexOf("lg:sticky lg:top-6");
  const headerIndex = source.indexOf("Haz tu pedido facil y rapido");
  const summaryIndex = source.indexOf("function SummaryPanel");
  const mobileBarIndex = source.indexOf("function MobileFloatingCheckoutBar");
  assert.ok(headerIndex >= 0, "El encabezado principal debe seguir presente en la cabecera.");
  assert.ok(summaryIndex >= 0, "El resumen lateral debe seguir definido como componente.");
  assert.ok(mobileBarIndex > summaryIndex, "El resumen lateral debe aparecer antes de la barra mobile.");
  assert.ok(stickyIndex >= 0, "El resumen sticky lateral debe seguir presente en desktop.");
  assert.doesNotMatch(
    source.slice(headerIndex, stickyIndex),
    /Resumen del pedido/,
    "El header no debe duplicar el resumen sticky.",
  );
  assert.doesNotMatch(
    source.slice(summaryIndex, mobileBarIndex),
    /function ProgressOverview/,
    "El resumen sticky ya no debe depender del modulo pesado de progreso por cuadros.",
  );
  assert.match(
    source,
    /Productos protagonistas/,
    "La seccion de productos debe seguir abriendo como bloque protagonista.",
  );
  assert.match(
    source,
    /Pedido en vivo/,
    "La seccion de productos debe reforzar la sensacion de pedido en tiempo real.",
  );
  assert.match(
    source,
    /Tu pedido se arma en vivo/,
    "El sticky debe conservar una lectura breve de pedido en vivo.",
  );
  assert.match(
    source,
    /Cada toque actualiza el total y las cantidades en vivo/,
    "La seccion de productos debe dejar explicita la lectura del pedido en vivo.",
  );
  assert.match(
    source,
    /1 en tu pedido/,
    "Las tarjetas de producto deben reforzar cuantas unidades ya lleva el usuario.",
  );
  assert.match(
    source,
    /data-testid=\"storefront-inline-products\"[\s\S]*md:grid-cols-2/,
    "La lista de productos debe ser mas escaneable sin perder legibilidad en desktop.",
  );
  assert.doesNotMatch(
    source,
    /Beneficio visible|Feedback inmediato/,
    "La seccion de productos no debe competir con cajas secundarias redundantes.",
  );
  assert.match(
    source,
    /Si quieres, agrega una nota/,
    "Las observaciones deben quedar como una invitacion opcional y ligera.",
  );
  assert.match(
    source.slice(summaryIndex, mobileBarIndex),
    /Resumen del pedido[\s\S]*progressHeader\.title[\s\S]*progressHeader\.subtitle[\s\S]*Paso \{progressHeader\.currentStep\} de \{progressHeader\.totalSteps\}/,
    "El sticky debe orientar el header con progreso real y copy del paso actual.",
  );
  assert.match(
    source,
    /Completa tu nombre y WhatsApp para continuar con el pedido\.[\s\S]*Agrega lo que deseas pedir y revisa tu compra en tiempo real\.[\s\S]*Elige entrega y metodo de pago para dejar tu pedido listo\.[\s\S]*Verifica tus datos antes de enviar el pedido al negocio\.[\s\S]*Todo esta completo\. Ahora solo falta enviar tu pedido\./,
    "El sticky debe conservar los copies obligatorios de cada estado del progreso.",
  );
  assert.match(
    source.slice(summaryIndex, mobileBarIndex),
    /h-2 overflow-hidden rounded-full bg-\[#F1E7DB\][\s\S]*Math\.max\(progressPercent, 6\)/,
    "El header debe reemplazar badges por una barra de progreso compacta.",
  );
  assert.match(
    source.slice(summaryIndex, mobileBarIndex),
    /progressHeader\.isComplete[\s\S]*10B981[\s\S]*059669[\s\S]*F59E0B[\s\S]*D97706/,
    "La barra debe cambiar a verde solo cuando el flujo este completo y mantener el color principal en el resto.",
  );
  assert.doesNotMatch(
    source.slice(summaryIndex, mobileBarIndex),
    /pasos listos|Agrega productos/,
    "El header del sticky ya no debe depender de badges estaticos.",
  );
  assert.match(
    source,
    /Compra rapida y simple[\s\S]*Respuesta rapida por WhatsApp[\s\S]*Pago y entrega claros/,
    "El header debe comunicar tres beneficios comerciales cortos y equilibrados.",
  );
  assert.match(
    source,
    /grid grid-cols-3 gap-3 sm:gap-4 lg:gap-5/,
    "Los beneficios del header deben distribuirse sin tarjetas pesadas ni CTA redundante.",
  );
  assert.match(
    source,
    /Autorizo usar mis datos para gestionar este pedido y coordinar su entrega\./,
    "La autorizacion debe sonar natural y orientada a la compra.",
  );
  assert.doesNotMatch(source, /Ya casi terminas/, "El bloque previo al CTA final debe eliminarse.");
  assert.doesNotMatch(
    source,
    /Tus datos se usan solo para gestionar tu compra y coordinar la entrega o retiro\./,
    "El texto redundante encima del CTA final debe desaparecer.",
  );
  assert.match(
    source,
    /rows=\{4\}/,
    "Las observaciones deben quedar visualmente mas livianas que antes.",
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
    source.slice(summaryIndex, mobileBarIndex),
    /Productos agregados[\s\S]*<ul className=\"mt-2 space-y-0 divide-y divide-\[#EFE5DA\]\">/,
    "Los productos del sticky deben renderizarse como una lista compacta.",
  );
  assert.doesNotMatch(
    source.slice(summaryIndex, mobileBarIndex),
    /rounded-\[24px\] border border-\[#E8DDD0\] bg-\[#FFFDF9\] p-3\.5 shadow-\[0_8px_24px_rgba\(23,32,51,0\.04\)\]/,
    "El sticky no debe volver a fragmentarse en tarjetas internas pesadas.",
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
  assert.doesNotMatch(
    source,
    /Empezar pedido/,
    "La cabecera no debe duplicar la accion principal del formulario con un CTA redundante.",
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
