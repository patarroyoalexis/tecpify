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
    /Pide directo aqui/,
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
  const productsSectionIndex = source.indexOf('title="Arma tu pedido"');
  const summaryIndex = source.indexOf("function SummaryPanel");
  const mobileBarIndex = source.indexOf("function MobileFloatingCheckoutBar");
  assert.ok(productsSectionIndex >= 0, "La seccion de productos debe seguir estando presente.");
  assert.ok(summaryIndex >= 0, "El resumen lateral debe seguir definido como componente.");
  assert.ok(mobileBarIndex > summaryIndex, "El resumen lateral debe aparecer antes de la barra mobile.");
  assert.ok(stickyIndex >= 0, "El resumen sticky lateral debe seguir presente en desktop.");
  assert.doesNotMatch(
    source.slice(summaryIndex, mobileBarIndex),
    /function ProgressOverview/,
    "El resumen sticky ya no debe depender del modulo pesado de progreso por cuadros.",
  );

  assert.match(
    source,
    /Paso 2[\s\S]*Arma tu pedido/,
    "La cabecera de productos debe conservar el paso y el titulo en una sola linea jerarquica.",
  );
  assert.match(
    source,
    /Busca por nombre o descripcion/,
    "El buscador debe seguir visible dentro de la cabecera de la seccion.",
  );
  assert.match(
    source,
    /Catalogo actualizado/,
    "La seccion debe conservar una linea compacta de valor con estado del catalogo.",
  );
  assert.match(
    source,
    /Tu pedido se arma en vivo mientras eliges|Agrega productos para ver el total en vivo/,
    "La linea de apoyo debe seguir comunicando que el pedido se actualiza en vivo.",
  );
  assert.match(
    source,
    /compact[\s\S]*grid grid-cols-\[auto_minmax\(0,1fr\)_auto\] items-center gap-x-3[\s\S]*flex shrink-0 flex-col items-end justify-center gap-2/,
    "La tarjeta compacta debe mantener una composicion horizontal estable con precio y stepper alineados a la derecha.",
  );
  assert.match(
    source,
    /Precio[\s\S]*\{formatCurrency\(product\.price\)\}[\s\S]*\<div[\s\S]*flex items-center gap-2 rounded-\[22px\]/,
    "El precio debe quedar arriba del stepper dentro de la misma columna derecha.",
  );
  assert.doesNotMatch(
    source,
    /Total linea/,
    "La card de producto no debe mostrar total de linea dentro del bloque.",
  );
  assert.match(
    source,
    /data-testid=\"storefront-inline-products\"[\s\S]*space-y-2/,
    "La lista de productos debe mantenerse compacta y apilada sin volver a una grilla mas pesada.",
  );
  assert.match(
    source,
    /compact[\s\S]*recentlyUpdated/,
    "Los productos de la vista principal deben seguir usando la variante compacta.",
  );
  assert.doesNotMatch(
    source,
    /Productos protagonistas|Pedido en vivo|Ver catalogo completo|featuredProducts|isCatalogOpen/,
    "La seccion no debe reintroducir el bloque protagonista ni el cajon lateral.",
  );
  assert.match(
    source,
    /Si quieres, agrega una nota/,
    "Las observaciones deben quedar como una invitacion opcional y ligera.",
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
  assert.match(source, /step="Paso 3"[\s\S]*title="Entrega y pago"/, "El paso 3 debe seguir declarando su jerarquia principal.");
  assert.match(source, /complete=\{fulfillmentReady\}[\s\S]*compact/, "El paso 3 debe mantenerse en la variante compacta.");
  assert.match(
    source,
    /description="Elige la entrega y luego te mostramos solo los pagos compatibles\."/,
    "El paso 3 debe abrir compacto y priorizar la decision de entrega antes del pago.",
  );
  assert.match(source, /business\.availableDeliveryTypes\.map/, "La entrega debe iterar solo los tipos habilitados por el negocio.");
  assert.match(source, /mt-2\.5 grid gap-2\.5 md:grid-cols-2/, "La entrega debe mostrarse en una grilla corta de dos cards en desktop intermedio.");
  assert.match(
    source,
    /testId=\{`storefront-delivery-option-\$\{slugifyChoice\(type\)\}`\}[\s\S]*compact/,
    "La entrega debe renderizar cards compactas completamente clickeables.",
  );
  assert.match(
    source,
    /Elige primero la entrega[\s\S]*solo mostramos metodos reales y compatibles con tu pedido/,
    "El bloque de pago debe quedarse informativo hasta que exista una entrega elegida.",
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
