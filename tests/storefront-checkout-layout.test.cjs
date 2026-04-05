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
  const businessesSource = read("data/businesses.ts");

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
  const mobileBarIndex = source.indexOf("function MobileStickyCheckoutSummary");
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
    /Busca por nombre o descrip/,
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
    /type MobileSummaryMode = "inline" \| "compact" \| "micro"/,
    "El resumen mobile debe declarar sus tres estados visuales.",
  );
  assert.match(
    source,
    /const summaryMode = getMobileSummaryMode\(/,
    "El resumen mobile debe derivar un modo unico a partir del hero y el teclado.",
  );
  assert.match(
    source,
    /focusin[\s\S]*focusout[\s\S]*visualViewport/,
    "El sticky mobile debe detectar teclado con foco y cambios reales de viewport.",
  );
  assert.match(
    source,
    /data-summary-mode=\{summaryMode\}/,
    "El resumen mobile debe exponer su estado visual actual en el DOM.",
  );
  assert.match(
    source,
    /--vvh/,
    "El layout mobile debe guardar la altura visible real del viewport en una CSS custom property.",
  );
  assert.match(
    source,
    /--storefront-mobile-sticky-top/,
    "El sticky mobile debe usar el offset real de visualViewport para Safari/iPhone.",
  );
  assert.match(
    source,
    /--storefront-mobile-summary-reserve/,
    "El contenido inferior debe reservar espacio segun la altura real del resumen activo.",
  );
  assert.match(
    source,
    /isInline \? "relative mt-3" : "sticky top-0 z-30/,
    "El modo inline no debe comportarse como sticky protagonista.",
  );
  assert.match(
    source,
    /transition-\[padding,transform,opacity,box-shadow,background-color,border-color,gap\][\s\S]*transition-\[max-height,opacity,transform,margin,padding\]/,
    "Las transiciones deben plegar el resumen por capas y no por reemplazo brusco.",
  );
  assert.match(
    source,
    /isMicro \? "mt-1\.5" : isInline \? "mt-2" : "mt-2"/,
    "El modo micro debe compactar el espaciado vertical del resumen.",
  );
  assert.match(
    source,
    /isCompact \? "mt-2 max-h-20 opacity-100 translate-y-0" : "mt-0 max-h-0 opacity-0 -translate-y-1 pointer-events-none"/,
    "El CTA y el feedback deben aparecer solo en compact y colapsar en micro o inline.",
  );
  assert.match(
    source,
    /const modeLabel = isMicro[\s\S]*\? `Paso \$\{summaryHeader\.currentStep\}`[\s\S]*: `Paso \$\{summaryHeader\.currentStep\} de \$\{summaryHeader\.totalSteps\}`/,
    "El modo micro debe mostrar el paso actual en formato corto.",
  );
  assert.match(
    source,
    /summaryMode=\{summaryMode\}/,
    "El render mobile debe consumir el modo visual derivado.",
  );
  assert.match(
    source,
    /paddingTop: `var\(--storefront-mobile-summary-reserve\)`/,
    "El wrapper de contenido debe reservar espacio cuando el resumen entra en sticky.",
  );
  assert.doesNotMatch(
    source,
    /data-testid=\"storefront-order-wizard\"[\s\S]*min-h-screen/,
    "El storefront mobile no debe depender de min-h-screen para su layout principal.",
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
    /rows=\{3\}/,
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
    /Subtotal[\s\S]*Domicilio[\s\S]*Total/,
    "El resumen sticky debe mostrar siempre subtotal, domicilio y total.",
  );
  assert.match(
    source,
    /storefront-delivery-neighborhood-select/,
    "El checkout debe pedir el barrio desde una fuente controlada para cotizar domicilio.",
  );
  assert.match(
    source,
    /storefront-delivery-reference-input/,
    "El checkout debe contemplar una referencia operativa separada de la direccion detallada.",
  );
  assert.doesNotMatch(
    source,
    /segun zona/,
    "La UX publica ya no debe exponer copys de zonas internas al cliente.",
  );
  assert.match(source, /step="Paso 3"[\s\S]*title="Entrega y pago"/, "El paso 3 debe seguir declarando su jerarquia principal.");
  assert.match(source, /complete=\{fulfillmentReady\}[\s\S]*compact/, "El paso 3 debe mantenerse en la variante compacta.");
  assert.match(
    source,
    /description="Elige la entrega y luego te mostramos solo los pagos compatibles\."/,
    "El paso 3 debe abrir compacto y priorizar la decision de entrega antes del pago.",
  );
  assert.match(source, /business\.availableDeliveryTypes\.map/, "La entrega debe iterar solo los tipos habilitados por el negocio.");
  assert.match(
    businessesSource,
    /if \(localDelivery\.isEnabled\) \{\s*deliveryTypes\.unshift\("domicilio"\);/s,
    "Domicilio debe volver a aparecer cuando el negocio lo tiene habilitado en su contrato publico.",
  );
  assert.match(source, /mt-2\.5 grid gap-2\.5 md:grid-cols-2/, "La entrega debe mostrarse en una grilla corta de dos cards en desktop intermedio.");
  assert.match(
    source,
    /testId=\{`storefront-delivery-option-\$\{slugifyChoice\(type\)\}`\}[\s\S]*compact/,
    "La entrega debe renderizar cards compactas completamente clickeables.",
  );
  assert.match(
    source,
    /const nextNeighborhoodId = event\.target\.value;[\s\S]*setDeliveryNeighborhoodId\(nextNeighborhoodId\);[\s\S]*setLocalDeliveryQuote\(null\);[\s\S]*setIsQuotingDelivery\(/,
    "Cambiar de barrio debe limpiar de inmediato la cotizacion previa antes de mostrar la nueva.",
  );
  assert.match(
    source,
    /const deliveryOptions = useMemo\([\s\S]*const disabled = type === "domicilio" && localDeliveryConfig\.status !== "available";/,
    "La card de Domicilio debe poder seguir visible, pero quedar deshabilitada cuando la cotizacion publica no este operativa.",
  );
  assert.match(
    source,
    /<ChoiceCard[\s\S]*disabled=\{disabled\}/,
    "El render del paso 3 debe respetar el estado seleccionable real de cada opcion de entrega.",
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
    /data-testid=\"storefront-mobile-summary-sticky\"[\s\S]*sticky top-0 z-30/,
    "La experiencia mobile debe mostrar un resumen superior compacto solo cuando el hero deja de estar visible.",
  );
  assert.match(
    source,
    /sectionId=\"storefront-products-section\"/,
    "El bloque de productos debe seguir teniendo un ancla clara para el salto rapido mobile.",
  );
});
