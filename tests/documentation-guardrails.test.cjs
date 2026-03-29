/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  formatTransitions,
  getLegacyOwnerlessSqlClosureState,
} = require("./helpers/sql-migration-state.cjs");

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

const README_REQUIRED_HEADINGS = [
  "## 1. Que es Tecpify hoy",
  "## 2. Problema que resuelve",
  "## 3. Objetivo actual del MVP",
  "## 4. Circuito operativo validado",
  "## 5. Estado funcional actual",
  "## 6. Garantias tecnicas activas",
  "## 7. Limites actuales del producto",
  "## 8. Siguiente etapa del proyecto",
];

const AGENTS_REQUIRED_HEADINGS = [
  "## 1. Proposito",
  "## 2. Principios obligatorios",
  "## 3. Invariantes de arquitectura",
  "## 4. Reglas de contratos y naming",
  "## 5. Reglas de ownership y acceso",
  "## 6. Reglas de pedidos, pagos e historial",
  "## 7. Reglas sobre entorno y service role",
  "## 8. Auditoria obligatoria antes de cerrar cambios",
  "## 9. Criterio estricto para declarar un frente como cerrado",
];

const README_DEFINITIONS_HEADING = "### Definiciones canonicas del MVP";
const AGENTS_DEFINITIONS_HEADING = "### Definiciones canonicas del MVP";

const CANONICAL_DEFINITION_ITEMS = [
  "Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.",
  "`businessId` significa UUID de base de datos y `businessSlug` significa slug de URL; rutas, params y helpers deben respetar esa frontera.",
  "`productId` significa UUID interno de producto; no existe un alias publico alterno para ese identificador.",
  "`orderId` significa UUID interno del pedido y `orderCode` significa identificador visible/operativo del pedido.",
  "Los negocios legacy sin owner son casos invalidos/no soportados del MVP: permanecen inaccesibles en workspace, storefront y pedidos operativos, y cualquier saneamiento debe ocurrir fuera del runtime antes de persistir `businesses.created_by_user_id`.",
  "`status`, `paymentStatus`, `history` y cualquier metadato derivable del pedido no son verdad cruda confiable del cliente; el server y la DB los derivan, validan o bloquean.",
  "El runtime normal del MVP usa solo cliente publico/anon acotado, cliente autenticado SSR y RLS; `SUPABASE_SERVICE_ROLE_KEY` queda aislada fuera de esa frontera.",
  "Una garantia no se considera cerrada si vive solo en UI, solo en handlers HTTP o solo en documentacion; cuando corresponde al dominio, tambien debe existir en runtime, DB y tests automatizados.",
  "`README.md` y `AGENTS.md` no pueden declarar mas de lo que garantizan runtime + DB + tests.",
];

const FORBIDDEN_OWNERSHIP_ALIAS_PATTERN = new RegExp(
  [
    ["owner", "_id"].join(""),
    ["owner", "_user", "_id"].join(""),
    ["owner", "UserId"].join(""),
  ]
    .map((alias) => `\\b${alias}\\b`)
    .join("|"),
);

const FORBIDDEN_RUNTIME_OWNERSHIP_ALIAS_PATTERN = new RegExp(
  `\\b${["owner", "UserId"].join("")}\\b`,
);

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getLatestMigrationSourceByPattern(pattern) {
  const migrationFilenames = fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => pattern.test(fs.readFileSync(path.join(migrationsDir, filename), "utf8")))
    .sort();

  if (migrationFilenames.length === 0) {
    throw new Error(`No se encontro una migracion que coincida con ${pattern}.`);
  }

  return fs.readFileSync(path.join(migrationsDir, migrationFilenames.at(-1)), "utf8");
}

function extractSqlFunctionBlock(source, functionName) {
  const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(
      `create(?:\\s+or\\s+replace)?\\s+function\\s+${escapedFunctionName}\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  );

  return match?.[0] ?? "";
}

function getSectionBulletItems(relativePath, heading) {
  const lines = readFile(relativePath).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  assert.notEqual(startIndex, -1, `${relativePath} no contiene la seccion canonica "${heading}".`);

  const items = [];
  let collectingItems = false;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();

    if (trimmedLine.startsWith("## ") || trimmedLine.startsWith("### ")) {
      break;
    }

    if (trimmedLine.startsWith("- ")) {
      collectingItems = true;
      items.push(trimmedLine.slice(2));
      continue;
    }

    if (collectingItems && trimmedLine.length > 0) {
      break;
    }
  }

  return items;
}

function assertContainsHeadings(relativePath, headings) {
  const source = readFile(relativePath);

  for (const heading of headings) {
    assert.match(
      source,
      new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
      `${relativePath} debe incluir la seccion "${heading}".`,
    );
  }
}

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function getAllRepoFiles(rootDirectory) {
  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".next" || entry.name === "node_modules") {
      continue;
    }

    const absolutePath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllRepoFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

test("documentacion: README y AGENTS mantienen estructura y definiciones canonicas", () => {
  assertContainsHeadings("README.md", README_REQUIRED_HEADINGS);
  assertContainsHeadings("AGENTS.md", AGENTS_REQUIRED_HEADINGS);
  assert.deepEqual(
    getSectionBulletItems("README.md", README_DEFINITIONS_HEADING).sort(),
    [...CANONICAL_DEFINITION_ITEMS].sort(),
    "README.md debe mantener exactamente las definiciones canonicas del MVP.",
  );
  assert.deepEqual(
    getSectionBulletItems("AGENTS.md", AGENTS_DEFINITIONS_HEADING).sort(),
    [...CANONICAL_DEFINITION_ITEMS].sort(),
    "AGENTS.md debe compartir exactamente las mismas definiciones canonicas del MVP.",
  );
});

test("documentacion: las afirmaciones contractuales siguen alineadas con el codigo real", () => {
  const readmeSource = readFile("README.md");
  const agentsSource = readFile("AGENTS.md");
  const businessesApiSource = readFile("app/api/businesses/route.ts");
  const productsApiSource = readFile("app/api/products/route.ts");
  const productByIdApiSource = readFile("app/api/products/[productId]/route.ts");
  const ordersApiSource = readFile("app/api/orders/route.ts");
  const workspaceOrdersApiSource = readFile("app/api/orders/private/route.ts");
  const orderByIdApiSource = readFile("app/api/orders/[orderId]/route.ts");
  const envSource = readFile("lib/env.ts");
  const supabaseServerSource = readFile("lib/supabase/server.ts");
  const supabaseClientSource = readFile("lib/supabase/client.ts");
  const serviceRoleClientSource = readFile("lib/supabase/internal/service-role-client.ts");
  const businessesDataSource = readFile("data/businesses.ts");
  const businessAccessSource = readFile("lib/auth/business-access.ts");
  const operationalHomeSource = readFile("components/home/operational-home.tsx");
  const legacyBusinessAccessSource = readFile("lib/auth/legacy-business-access.ts");
  const privateBusinessPagesSource = readFile("lib/page-contracts/private-business-pages.ts");
  const storefrontOrderPageSource = readFile("lib/page-contracts/storefront-order-page.ts");
  const productsDataSource = readFile("lib/data/products.ts");
  const ordersDataSource = readFile("lib/data/orders-server.ts");
  const orderStateRulesSource = readFile("lib/orders/state-rules.ts");
  const orderHistoryRulesSource = readFile("lib/orders/history-rules.ts");
  const privateMetricsSpecSource = readFile("tests/e2e/private-metrics.spec.ts");
  const paymentHelpersSource = readFile("components/dashboard/payment-helpers.ts");
  const businessOrdersHookSource = readFile("components/dashboard/use-business-orders.ts");
  const ordersInsertPayloadBlock = ordersDataSource.match(
    /const insertPayload = \{(?<block>[\s\S]*?)\n\s*};/,
  );
  const ordersUpdatePayloadBlocks = [
    ...ordersDataSource.matchAll(/updatePayload\s*=\s*\{(?<block>[\s\S]*?)\n\s*};/g),
  ];
  const orderPaymentMigrationSource = getLatestMigrationSourceByPattern(
    /create(?:\s+or\s+replace)?\s+function\s+public\.orders_payment_method_is_valid/i,
  );
  const orderPaymentMethodValidationSource = extractSqlFunctionBlock(
    orderPaymentMigrationSource,
    "public.orders_payment_method_is_valid",
  );
  const orderHistoryMigrationSource = getLatestMigrationSourceByPattern(
    /create(?:\s+or\s+replace)?\s+function\s+public\.update_order_with_server_history/i,
  );
  const productDeleteMigrationSource = getLatestMigrationSourceByPattern(
    /create(?:\s+or\s+replace)?\s+function\s+public\.products_block_delete_when_referenced_by_orders/i,
  );
  const legacyOwnerlessSqlClosureState = getLegacyOwnerlessSqlClosureState();

  assert.match(
    readmeSource,
    /casos invalidos\/no soportados del MVP/i,
    "README.md debe describir honestamente la estrategia final para negocios ownerless.",
  );
  assert.match(
    agentsSource,
    /cualquier saneamiento debe ocurrir fuera del runtime/i,
    "AGENTS.md debe describir honestamente la estrategia final para negocios ownerless.",
  );
  assert.match(
    readmeSource,
    /definicion final efectiva/i,
    "README.md debe documentar que la estrategia ownerless tambien queda cerrada en la definicion final efectiva.",
  );
  assert.match(
    agentsSource,
    /definicion final efectiva/i,
    "AGENTS.md debe documentar que la estrategia ownerless tambien queda cerrada en la definicion final efectiva.",
  );
  assert.match(
    readmeSource,
    /public\.businesses\.created_by_user_id[\s\S]*createdByUserId/i,
    "README.md debe fijar la frontera entre el detalle SQL created_by_user_id y el contrato TypeScript createdByUserId.",
  );
  assert.match(
    agentsSource,
    /public\.businesses\.created_by_user_id[\s\S]*createdByUserId/i,
    "AGENTS.md debe fijar la frontera entre el detalle SQL created_by_user_id y el contrato TypeScript createdByUserId.",
  );
  assert.doesNotMatch(
    readmeSource,
    FORBIDDEN_OWNERSHIP_ALIAS_PATTERN,
    "README.md no debe reintroducir aliases falsos de ownership.",
  );
  assert.doesNotMatch(
    agentsSource,
    FORBIDDEN_OWNERSHIP_ALIAS_PATTERN,
    "AGENTS.md no debe reintroducir aliases falsos de ownership.",
  );
  assert.doesNotMatch(
    readmeSource,
    /remediacion auditable|claim controlado/i,
    "README.md no debe prometer una remediacion legacy que el MVP no ejecuta.",
  );
  assert.doesNotMatch(
    agentsSource,
    /remediacion auditable|claim controlado/i,
    "AGENTS.md no debe prometer una remediacion legacy que el guardian ya no respalda.",
  );
  assert.doesNotMatch(
    readmeSource,
    /20260326004_add_legacy_business_ownership_remediation|sigue inconsistente|no puede declararse cerrado/i,
    "README.md no puede seguir describiendo ownerless como un frente abierto despues del cierre SQL efectivo.",
  );
  assert.doesNotMatch(
    agentsSource,
    /20260326004_add_legacy_business_ownership_remediation|contradiccion estructural|no puede declararse cerrado todavia/i,
    "AGENTS.md no puede seguir describiendo ownerless como una contradiccion abierta despues del cierre SQL efectivo.",
  );
  assert.match(
    readmeSource,
    /bootstrap(?:ea|ear)?.*fixtures.*Auth/i,
    "README.md debe documentar el bootstrap seguro de fixtures E2E en lugar de cuentas humanas reutilizadas.",
  );
  assert.match(
    readmeSource,
    /Google OAuth opcional.*solo como carril secundario en `\/login`/i,
    "README.md debe describir Google OAuth como una opcion secundaria acotada a /login y no como reemplazo de email/password.",
  );
  assert.match(
    agentsSource,
    /Google OAuth puede existir solo como opcion secundaria de login/i,
    "AGENTS.md debe describir Google OAuth como superficie opcional, complementaria y acotada a login.",
  );
  assert.doesNotMatch(
    readmeSource,
    /Google OAuth[\s\S]*tambien se expone en `\/register`|Google OAuth[\s\S]*carril secundario de registro/i,
    "README.md no debe reabrir Google OAuth como superficie de register.",
  );
  assert.doesNotMatch(
    agentsSource,
    /Google OAuth[\s\S]*si se mantiene visible|Google OAuth[\s\S]*carril secundario de registro/i,
    "AGENTS.md no debe dejar ambiguo si Google tambien vive en register.",
  );
  assert.match(
    agentsSource,
    /bootstrap(?:ea|ear)?.*fixtures.*Auth/i,
    "AGENTS.md debe reflejar el contrato real del bootstrap E2E aislado de test.",
  );
  assert.match(
    readmeSource,
    /metricas.*evidencia E2E real.*Supabase enlazado/i,
    "README.md debe describir honestamente el cierre real de metricas privadas sobre el Supabase enlazado.",
  );
  assert.match(
    agentsSource,
    /metricas privadas.*quedan cerradas/i,
    "AGENTS.md debe describir honestamente el cierre real del frente de metricas privadas.",
  );
  assert.doesNotMatch(
    readmeSource,
    /todavia sin una spec E2E dedicada|suite E2E todavia no cubre metricas privadas/i,
    "README.md no puede seguir diciendo que no existe una spec dedicada para metricas privadas.",
  );
  assert.doesNotMatch(
    agentsSource,
    /no tienen una validacion E2E dedicada|frente sigue abierto hasta que el proyecto Supabase apuntado por Playwright/i,
    "AGENTS.md no puede seguir describiendo metricas privadas como un frente abierto por drift.",
  );
  assert.match(
    readmeSource,
    /borrado de productos usados.*runtime y DB/i,
    "README.md debe reflejar que el veto de borrado historico ya vive en runtime y DB.",
  );
  assert.match(
    readmeSource,
    /producto ya referenciado en pedidos historicos persistidos no puede borrarse/i,
    "README.md debe describir el veto canonico de borrado sobre historicos persistidos.",
  );
  assert.match(
    agentsSource,
    /pedidos historicos persistidos no puede borrarse/i,
    "AGENTS.md debe fijar que el producto historico solo puede desactivarse y no borrarse.",
  );
  assert.match(
    agentsSource,
    /trigger de DB y pruebas automatizadas/i,
    "AGENTS.md debe describir honestamente el cierre tecnico del veto de borrado historico.",
  );
  assert.doesNotMatch(
    readmeSource,
    /candado todavia no esta reforzado en DB|No tiene todavia un candado de DB equivalente|borrado seguro de productos siguen parciales/i,
    "README.md no puede seguir describiendo el veto de borrado historico como un frente abierto.",
  );
  assert.doesNotMatch(
    agentsSource,
    /bloqueo de borrado por uso historico vive hoy en runtime|ese candado no esta reforzado por DB/i,
    "AGENTS.md no puede seguir describiendo el veto de borrado historico como un frente abierto.",
  );
  assert.match(
    productDeleteMigrationSource,
    /create trigger products_block_delete_when_referenced_by_orders/i,
    "Las docs no pueden declarar cerrado el veto de borrado historico si la migracion efectiva no cablea el trigger en DB.",
  );
  assert.match(
    privateMetricsSpecSource,
    /unauthorized-business-access/i,
    "La spec dedicada de metricas debe cubrir el aislamiento frente a otro usuario autenticado.",
  );
  assert.match(
    privateMetricsSpecSource,
    /localStorage\.length/i,
    "La spec dedicada de metricas debe demostrar que el resultado no depende de localStorage.",
  );
  assert.match(
    privateMetricsSpecSource,
    /metrics-pending-fiado-banner|pendingFiadoCount/i,
    "La spec dedicada de metricas debe cubrir la regla activa del fiado pendiente fuera de ingresos efectivos.",
  );
  assert.doesNotMatch(
    readmeSource,
    /\bPLAYWRIGHT_OWNER_EMAIL\b|\bPLAYWRIGHT_OWNER_PASSWORD\b|\bPLAYWRIGHT_INTRUDER_EMAIL\b|\bPLAYWRIGHT_INTRUDER_PASSWORD\b/,
    "README.md no debe seguir documentando credenciales humanas reutilizables para E2E.",
  );
  assert.doesNotMatch(
    agentsSource,
    /\bPLAYWRIGHT_OWNER_EMAIL\b|\bPLAYWRIGHT_OWNER_PASSWORD\b|\bPLAYWRIGHT_INTRUDER_EMAIL\b|\bPLAYWRIGHT_INTRUDER_PASSWORD\b/,
    "AGENTS.md no debe seguir documentando credenciales humanas reutilizables para E2E.",
  );

  assert.match(
    businessesApiSource,
    /created_by_user_id:\s*authResult\.user\.userId/,
    "La creacion de negocios debe resolver ownership desde la sesion autenticada.",
  );
  assert.match(
    businessesApiSource,
    /createdByUserId:\s*row\.created_by_user_id/,
    "La respuesta de negocios debe mapear created_by_user_id hacia createdByUserId sin aliases paralelos.",
  );
  assert.match(
    businessAccessSource,
    /\bcreatedByUserId\b/,
    "La capa de acceso debe usar createdByUserId como contrato TypeScript de ownership.",
  );
  assert.doesNotMatch(
    businessAccessSource,
    FORBIDDEN_RUNTIME_OWNERSHIP_ALIAS_PATTERN,
    "La capa de acceso no debe conservar aliases paralelos de ownership.",
  );
  assert.match(
    businessesApiSource,
    /CREATE_BUSINESS_ALLOWED_FIELDS/,
    "La ruta de negocios debe vetar campos sensibles enviados por cliente.",
  );
  assert.match(
    productsApiSource,
    /PRODUCT_MUTATION_ALLOWED_FIELDS/,
    "La ruta de productos debe vetar campos sensibles enviados por cliente.",
  );
  assert.match(
    productByIdApiSource,
    /PRODUCT_MUTATION_ALLOWED_FIELDS/,
    "La ruta de productos por id debe vetar campos sensibles enviados por cliente.",
  );
  assert.match(
    productByIdApiSource,
    /parseProductId/,
    "La ruta privada de productos debe validar server-side que productId sea un UUID interno.",
  );
  assert.match(
    productsApiSource,
    /requireBusinessApiContext/,
    "La lectura o mutacion privada de productos debe validar ownership server-side.",
  );
  assert.match(
    productByIdApiSource,
    /requireBusinessApiContext/,
    "La mutacion privada de productos por id debe validar ownership server-side.",
  );
  assert.match(
    ordersApiSource,
    /requireBusinessApiContext/,
    "La lectura privada de pedidos debe validar ownership server-side.",
  );
  assert.match(
    ordersApiSource,
    /origin:\s*"public_form"/,
    "La creacion publica de pedidos debe declarar un origin server-side explicito.",
  );
  assert.match(
    ordersApiSource,
    /sanitizeClientCreateOrderPayload/,
    "La ruta publica de pedidos debe sanear campos sensibles derivados antes de persistir.",
  );
  assert.match(
    orderByIdApiSource,
    /requireOrderApiContext/,
    "La mutacion privada de pedidos debe validar ownership server-side.",
  );
  assert.match(
    workspaceOrdersApiSource,
    /requireBusinessApiContext/,
    "La creacion manual de pedidos debe validar ownership server-side.",
  );
  assert.match(
    workspaceOrdersApiSource,
    /origin:\s*"workspace_manual"/,
    "La creacion manual de pedidos debe declarar un origin server-side explicito.",
  );
  assert.match(
    workspaceOrdersApiSource,
    /businessId:\s*businessContextResult\.context\.businessId/,
    "La creacion manual debe persistir usando el businessId autenticado del contexto server-side.",
  );
  assert.match(
    workspaceOrdersApiSource,
    /sanitizeClientCreateOrderPayload/,
    "La ruta privada de pedidos debe sanear campos sensibles derivados antes de persistir.",
  );
  assert.match(
    supabaseServerSource,
    /keySource:\s*"NEXT_PUBLIC_SUPABASE_ANON_KEY"/,
    "lib/supabase/server.ts debe seguir usando la anon key en flujo normal.",
  );
  assert.match(
    supabaseServerSource,
    /getOperationalEnv/,
    "lib/supabase/server.ts debe depender solo del env operativo compartido.",
  );
  assert.match(
    supabaseClientSource,
    /getOperationalEnv/,
    "lib/supabase/client.ts debe depender solo del env operativo compartido.",
  );
  assert.match(
    supabaseServerSource,
    /isUsingServiceRole:\s*false/,
    "lib/supabase/server.ts no debe declarar uso de service role en flujo normal.",
  );
  assert.doesNotMatch(
    envSource,
    /\bSUPABASE_SERVICE_ROLE_KEY\b|\bsupabaseServiceRoleKey\b|\bgetServerEnv\b|\bServerEnv\b/,
    "lib/env.ts no debe mezclar el borde privilegiado con el env operativo.",
  );
  assert.match(
    serviceRoleClientSource,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
    "El helper privilegiado debe ser el unico que lea la service role desde process.env.",
  );
  assert.match(
    serviceRoleClientSource,
    /getOperationalEnv/,
    "El helper privilegiado debe reutilizar solo la parte operativa compartida del env.",
  );
  assert.match(
    businessesDataSource,
    /createServerSupabasePublicClient/,
    "La resolucion publica del storefront debe seguir pasando por el cliente publico de Supabase.",
  );
  assert.match(
    businessesDataSource,
    /createGetBusinessByIdWithProducts/,
    "La capa de datos debe exponer un helper byId honesto para businessId de base de datos.",
  );
  assert.doesNotMatch(
    businessesDataSource,
    /return\s+getBusinessBySlugWithProducts\(businessId\)/,
    "Un helper byId no puede delegar encubiertamente al lookup por slug.",
  );
  assert.match(
    businessesDataSource,
    /countUnsupportedLegacyBusinesses/,
    "La home operativa debe exponer solo el conteo de negocios legacy ownerless no soportados.",
  );
  assert.doesNotMatch(
    businessesDataSource,
    /listCurrentUserLegacyBusinessOwnershipRemediations/,
    "La home operativa no debe depender de un flujo runtime de remediacion legacy.",
  );
  assert.match(
    operationalHomeSource,
    /No soportados en runtime del MVP/,
    "La UI debe describir honestamente que los legacy ownerless no estan soportados en runtime.",
  );
  assert.match(
    operationalHomeSource,
    /Tecpify ya no ofrece remediacion ni claim dentro del producto/,
    "La UI no puede prometer una remediacion legacy inexistente.",
  );
  assert.doesNotMatch(
    operationalHomeSource,
    /LegacyBusinessRemediationPanel|Solicitar remediacion legacy|Reclamar ownership|claim controlado/i,
    "La UI no debe conservar superficies ni copy de remediacion runtime.",
  );
  assert.match(
    legacyBusinessAccessSource,
    /unsupported_ownerless_blocked|ownerless_unsupported/,
    "La estrategia de ownership debe declarar que ownerless es un caso bloqueado y no soportado.",
  );
  assert.match(
    legacyBusinessAccessSource,
    /\bcreatedByUserId\b/,
    "La estrategia legacy debe usar createdByUserId como contrato TypeScript de ownership.",
  );
  assert.doesNotMatch(
    legacyBusinessAccessSource,
    new RegExp(
      [
        "ownerless_requested",
        "ownerless_claimable",
        "remediated",
        ["owner", "UserId"].join(""),
      ]
        .map((pattern) => (pattern.includes("_") || pattern === "remediated" ? pattern : `\\b${pattern}\\b`))
        .join("|"),
    ),
    "La capa de acceso no debe seguir modelando estados de remediacion runtime.",
  );
  assert.match(
    privateBusinessPagesSource,
    /params:\s*Promise<\{\s*businessSlug:\s*string\s*\}>/,
    "Los page contracts privados deben recibir businessSlug cuando el valor real es el slug de URL.",
  );
  assert.doesNotMatch(
    privateBusinessPagesSource,
    /\bnegocioId\b|params:\s*Promise<\{\s*businessId:\s*string\s*\}>/,
    "Los page contracts privados no deben exponer negocioId ni businessId engañosos para slugs.",
  );
  assert.match(
    storefrontOrderPageSource,
    /params:\s*Promise<\{\s*businessSlug:\s*string\s*\}>/,
    "El page contract publico debe recibir businessSlug cuando el valor real es el slug de URL.",
  );
  assert.doesNotMatch(
    storefrontOrderPageSource,
    /\bnegocioId\b|params:\s*Promise<\{\s*businessId:\s*string\s*\}>/,
    "El page contract publico no debe exponer negocioId ni businessId engañosos para slugs.",
  );
  assert.match(
    productsDataSource,
    /createServerSupabasePublicClient/,
    "El catalogo publico debe seguir leyendo con cliente publico de Supabase.",
  );
  assert.match(
    productsDataSource,
    /createServerSupabaseAuthClient/,
    "El catalogo privado debe seguir leyendo o mutando con cliente autenticado SSR.",
  );
  assert.match(
    ordersDataSource,
    /buildInitialOrderServerState/,
    "La creacion de pedidos debe derivar estado e historial inicial desde servidor.",
  );
  assert.match(
    ordersDataSource,
    /getOrderPaymentMethodDeliveryTypeError/,
    "La creacion de pedidos debe validar reglas de pago como Contra entrega tambien en servidor.",
  );
  assert.match(
    ordersDataSource,
    /resolveAuthoritativeOrderStatePatch/,
    "La mutacion de pedidos debe pasar por el resolvedor central de estado y pago.",
  );
  assert.match(
    ordersDataSource,
    /update_order_with_server_history/,
    "La mutacion de pedidos debe pasar por la funcion controlada que anexa historial en DB.",
  );
  assert.doesNotMatch(
    ordersDataSource,
    /appendServerGeneratedOrderHistory/,
    "La capa de datos no debe volver a anexar history desde Next.js.",
  );
  assert.ok(
    ordersInsertPayloadBlock?.groups?.block,
    "La persistencia del insert debe conservar un bloque identificable para guardrails.",
  );
  assert.doesNotMatch(
    ordersInsertPayloadBlock.groups.block,
    /\bhistory:/,
    "El insert persistido no debe volver a incluir history como payload directo.",
  );
  assert.ok(
    ordersUpdatePayloadBlocks.length > 0,
    "La persistencia del patch debe conservar bloques identificables para guardrails.",
  );
  for (const ordersUpdatePayloadBlock of ordersUpdatePayloadBlocks) {
    assert.ok(
      ordersUpdatePayloadBlock.groups?.block,
      "Cada bloque de patch persistido debe poder auditarse.",
    );
    assert.doesNotMatch(
      ordersUpdatePayloadBlock.groups.block,
      /\bhistory:/,
      "El patch persistido no debe volver a incluir history como payload directo.",
    );
  }
  assert.match(
    ordersDataSource,
    /options\?\.businessId/,
    "La creacion privada de pedidos debe poder reutilizar el businessId resuelto por el contexto autenticado.",
  );
  assert.match(
    ordersDataSource,
    /createServerSupabaseAuthClient/,
    "La lectura, mutacion y creacion privada de pedidos debe seguir usando cliente autenticado SSR.",
  );
  assert.match(
    ordersDataSource,
    /createServerSupabasePublicClient/,
    "La creacion publica de pedidos debe seguir usando cliente publico de Supabase.",
  );
  assert.match(
    orderStateRulesSource,
    /sanitizeClientCreateOrderPayload/,
    "El nucleo de reglas debe sanear los campos sensibles derivados del POST.",
  );
  assert.match(
    orderStateRulesSource,
    /collectLegacyOrderProductAliasFields|"product_id" in product/,
    "El POST debe bloquear aliases legacy dentro de products y exigir productId canónico.",
  );
  assert.match(
    orderStateRulesSource,
    /deriveInitialOrderStateFromPaymentMethod/,
    "El nucleo de reglas debe derivar el estado inicial segun el metodo de pago.",
  );
  assert.match(
    orderStateRulesSource,
    /isPaymentMethodAllowedForDeliveryType|getOrderPaymentMethodDeliveryTypeError/,
    "El nucleo de reglas debe validar server-side la compatibilidad entre entrega y metodo de pago.",
  );
  assert.match(
    orderStateRulesSource,
    /resolveAuthoritativeOrderStatePatch/,
    "El nucleo de reglas debe resolver y validar el snapshot autoritativo del PATCH.",
  );
  assert.match(
    paymentHelpersSource,
    /isPaymentMethodAllowedForDeliveryType/,
    "La UI debe reutilizar la regla central de pago y no mantener Contra entrega solo en cliente.",
  );
  assert.match(
    orderHistoryRulesSource,
    /createInitialOrderHistory/,
    "El historial inicial debe vivir en un modulo central server-side.",
  );
  assert.match(
    orderHistoryRulesSource,
    /appendServerGeneratedOrderHistory/,
    "Los eventos posteriores del historial deben derivarse en un modulo central server-side.",
  );
  assert.doesNotMatch(
    businessOrdersHookSource,
    /createHistoryEvent|appendOrderEvent/,
    "El cliente no debe volver a fabricar eventos de historial antes de mutar pedidos.",
  );
  assert.equal(
    fs.existsSync(path.join(repoRoot, "lib", "data", "business-ownership-remediation.ts")),
    false,
    "El repo no debe conservar un helper runtime para remediacion legacy.",
  );
  assert.equal(
    fs.existsSync(
      path.join(repoRoot, "app", "api", "businesses", "legacy-remediation", "request", "route.ts"),
    ),
    false,
    "El repo no debe conservar una ruta runtime para solicitar remediacion legacy.",
  );
  assert.equal(
    fs.existsSync(
      path.join(repoRoot, "app", "api", "businesses", "legacy-remediation", "grant", "route.ts"),
    ),
    false,
    "El repo no debe conservar una ruta runtime para habilitar claim legacy.",
  );
  assert.equal(
    fs.existsSync(
      path.join(repoRoot, "app", "api", "businesses", "legacy-remediation", "claim", "route.ts"),
    ),
    false,
    "El repo no debe conservar una ruta runtime para reclamar ownership legacy.",
  );
  assert.equal(
    fs.existsSync(
      path.join(repoRoot, "app", "api", "businesses", "legacy-remediation", "list", "route.ts"),
    ),
    false,
    "El repo no debe conservar una ruta runtime para listar remediaciones legacy.",
  );
  for (const retiredSurface of [
    ...legacyOwnerlessSqlClosureState.forbiddenTables,
    ...legacyOwnerlessSqlClosureState.forbiddenFunctions,
    ...legacyOwnerlessSqlClosureState.forbiddenTriggers,
  ]) {
    assert.equal(
      retiredSurface.state,
      "absent",
      `${retiredSurface.name} debe quedar retirado en la definicion final efectiva. Transiciones: ${formatTransitions(retiredSurface.transitions)}`,
    );
  }
  for (const grantState of legacyOwnerlessSqlClosureState.authenticatedGrantStates) {
    assert.equal(
      grantState.granted,
      false,
      `${grantState.name} no puede quedar concedido a authenticated. Transiciones: ${formatTransitions(grantState.transitions)}`,
    );
  }
  assert.equal(
    legacyOwnerlessSqlClosureState.blockerFunction.state,
    "present",
    `La base debe conservar la funcion veto ownerless -> owned. Transiciones: ${formatTransitions(legacyOwnerlessSqlClosureState.blockerFunction.transitions)}`,
  );
  assert.equal(
    legacyOwnerlessSqlClosureState.blockerTrigger.state,
    "present",
    `La base debe conservar el trigger veto ownerless -> owned. Transiciones: ${formatTransitions(legacyOwnerlessSqlClosureState.blockerTrigger.transitions)}`,
  );
  assert.match(
    legacyOwnerlessSqlClosureState.blockerFunction.latestMigration?.source ?? "",
    /cannot be claimed or reassigned in runtime/i,
    "La base debe declarar de forma explicita que ownerless no es remediable en runtime.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /create policy "public can create orders"[\s\S]*to anon/i,
    "La policy publica de insert debe quedar restringida a anon para no abrir bypass de ownership.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /orders_insert_request_is_valid/i,
    "Supabase debe separar la validacion del request base del insert antes del trigger autoritativo.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /create policy "authenticated can insert owned orders"[\s\S]*created_by_user_id = auth\.uid\(\)/i,
    "Supabase debe separar el insert autenticado de pedidos bajo ownership real.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /orders_payment_write_is_valid/i,
    "Supabase debe exponer una validacion reutilizable para blindar writes directos de orders.",
  );
  assert.match(
    orderPaymentMethodValidationSource,
    /'Transferencia'/,
    "La definicion efectiva de metodos de pago en DB debe aceptar Transferencia como metodo generico.",
  );
  assert.doesNotMatch(
    orderPaymentMethodValidationSource,
    /'Nequi'|'Daviplata'|'Bre-B'/,
    "La definicion efectiva de metodos de pago en DB no debe conservar aliases separados para transferencias.",
  );
  assert.match(
    readmeSource,
    /flags publicos[\s\S]*acceptsCash[\s\S]*acceptsTransfer[\s\S]*acceptsCard[\s\S]*allowsFiado/i,
    "README.md debe documentar los flags operativos del negocio y el caracter interno de allowsFiado.",
  );
  assert.match(
    agentsSource,
    /accepts_cash.*accepts_transfer.*accepts_card.*allows_fiado/i,
    "AGENTS.md debe documentar los flags persistidos del negocio para metodos publicos y fiado interno.",
  );
  assert.match(
    readmeSource,
    /no toca Google OAuth real/i,
    "README.md debe documentar que el carril E2E estable no depende de Google OAuth.",
  );
  assert.match(
    readmeSource,
    /rechaza callbacks OAuth directos con `code`/i,
    "README.md debe documentar que la flag apagada tambien bloquea callbacks OAuth directos.",
  );
  assert.match(
    agentsSource,
    /no se expone en `\/login` ni se admite el callback OAuth con `code`/i,
    "AGENTS.md debe fijar el mismo cierre runtime cuando la flag de Google esta apagada.",
  );
  assert.match(
    agentsSource,
    /fixtures dedicadas por email\/password/i,
    "AGENTS.md debe fijar que el circuito automatizado estable sigue entrando por email/password.",
  );
  assert.match(
    readmeSource,
    /Fiado .*nunca aparece en checkout ni formularios del cliente/i,
    "README.md debe describir que Fiado es interno y no publico.",
  );
  assert.match(
    agentsSource,
    /Fiado .*solo puede activarse en superficie privada autorizada/i,
    "AGENTS.md debe describir que Fiado es una operacion privada autorizada.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /orders_enforce_authoritative_payment_before_insert/i,
    "Supabase debe derivar el estado inicial de pago tambien en DB.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /orders_enforce_authoritative_payment_before_update/i,
    "Supabase debe validar updates directos de orders tambien en DB.",
  );
  assert.match(
    orderPaymentMigrationSource,
    /Contra entrega solo se permite en pedidos a domicilio\./i,
    "Supabase debe bloquear Contra entrega fuera del flujo permitido.",
  );
  assert.match(
    orderHistoryMigrationSource,
    /orders_enforce_server_generated_history_before_insert/i,
    "Supabase debe generar el historial inicial desde DB tambien en inserts directos.",
  );
  assert.match(
    orderHistoryMigrationSource,
    /history es server-generated y no acepta eventos iniciales enviados por cliente/i,
    "Supabase debe rechazar inserts directos con history inicial arbitrario.",
  );
  assert.match(
    orderHistoryMigrationSource,
    /orders_block_direct_history_before_update/i,
    "Supabase debe bloquear updates directos que intenten reemplazar history.",
  );
  assert.match(
    orderHistoryMigrationSource,
    /public\.update_order_with_server_history/i,
    "El append-only del historial debe pasar por una funcion controlada de DB.",
  );
  assert.match(
    orderHistoryMigrationSource,
    /grant execute on function public\.update_order_with_server_history\(uuid, jsonb\) to authenticated/i,
    "La funcion controlada del historial solo debe exponerse a la frontera autenticada permitida.",
  );

  const localStorageUsageFiles = getAllRepoFiles(repoRoot)
    .map((absolutePath) => normalizeRelativePath(path.relative(repoRoot, absolutePath)))
    .filter((relativePath) => /\.(?:[cm]?[jt]sx?)$/i.test(relativePath))
    .filter((relativePath) => !relativePath.startsWith("tests/"))
    .filter((relativePath) => /\blocalStorage\b/.test(readFile(relativePath)));

  assert.ok(
    localStorageUsageFiles.every(
      (relativePath) => relativePath === "components/dashboard/orders-workspace.tsx",
    ),
    `localStorage solo puede vivir en frontera de UI no critica: ${localStorageUsageFiles.join(", ")}`,
  );
});
