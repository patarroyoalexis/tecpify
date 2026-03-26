/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

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
  "Los negocios legacy sin owner son casos invalidos/no soportados del MVP: permanecen inaccesibles en workspace, storefront y pedidos operativos, y cualquier saneamiento debe ocurrir fuera del runtime antes de persistir `businesses.created_by_user_id`.",
  "`status`, `paymentStatus`, `history` y cualquier metadato derivable del pedido no son verdad cruda confiable del cliente; el server y la DB los derivan, validan o bloquean.",
  "El runtime normal del MVP usa solo cliente publico/anon acotado, cliente autenticado SSR y RLS; `SUPABASE_SERVICE_ROLE_KEY` queda aislada fuera de esa frontera.",
  "Una garantia no se considera cerrada si vive solo en UI, solo en handlers HTTP o solo en documentacion; cuando corresponde al dominio, tambien debe existir en runtime, DB y tests automatizados.",
  "`README.md` y `AGENTS.md` no pueden declarar mas de lo que garantizan runtime + DB + tests.",
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
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
  const operationalHomeSource = readFile("components/home/operational-home.tsx");
  const legacyBusinessAccessSource = readFile("lib/auth/legacy-business-access.ts");
  const privateBusinessPagesSource = readFile("lib/page-contracts/private-business-pages.ts");
  const storefrontOrderPageSource = readFile("lib/page-contracts/storefront-order-page.ts");
  const productsDataSource = readFile("lib/data/products.ts");
  const ordersDataSource = readFile("lib/data/orders-server.ts");
  const orderStateRulesSource = readFile("lib/orders/state-rules.ts");
  const orderHistoryRulesSource = readFile("lib/orders/history-rules.ts");
  const paymentHelpersSource = readFile("components/dashboard/payment-helpers.ts");
  const businessOrdersHookSource = readFile("components/dashboard/use-business-orders.ts");
  const ordersInsertPayloadBlock = ordersDataSource.match(
    /const insertPayload = \{(?<block>[\s\S]*?)\n\s*};/,
  );
  const ordersUpdatePayloadBlock = ordersDataSource.match(
    /const updatePayload = \{(?<block>[\s\S]*?)\n\s*};/,
  );
  const legacyRemediationRetirementMigrationSource = readFile(
    "supabase/migrations/20260326_retire_legacy_business_runtime_remediation.sql",
  );
  const orderPaymentMigrationSource = readFile(
    "supabase/migrations/20260326_enforce_order_payment_rules_in_db.sql",
  );
  const orderHistoryMigrationSource = readFile(
    "supabase/migrations/20260326_enforce_order_history_in_db.sql",
  );

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

  assert.match(
    businessesApiSource,
    /created_by_user_id:\s*authResult\.user\.userId/,
    "La creacion de negocios debe resolver ownership desde la sesion autenticada.",
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
  assert.doesNotMatch(
    legacyBusinessAccessSource,
    /ownerless_requested|ownerless_claimable|remediated/,
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
    ordersUpdatePayloadBlock?.groups?.block,
    "La persistencia del patch debe conservar un bloque identificable para guardrails.",
  );
  assert.doesNotMatch(
    ordersUpdatePayloadBlock.groups.block,
    /\bhistory:/,
    "El patch persistido no debe volver a incluir history como payload directo.",
  );
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
      path.join(repoRoot, "app", "api", "businesses", "legacy-remediation", "claim", "route.ts"),
    ),
    false,
    "El repo no debe conservar una ruta runtime para reclamar ownership legacy.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /drop function if exists public\.request_legacy_business_ownership_remediation\(text\) cascade/i,
    "La migracion final debe retirar la solicitud runtime legacy.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /drop function if exists public\.grant_legacy_business_owner_claim\(text, text\) cascade/i,
    "La migracion final debe retirar la habilitacion runtime de claim legacy.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /drop function if exists public\.claim_legacy_business_ownership\(text\) cascade/i,
    "La migracion final debe retirar el claim runtime legacy.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /drop table if exists public\.legacy_business_ownership_remediation_events cascade/i,
    "La migracion final no debe dejar la remediacion solo en tablas SQL aisladas.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /drop table if exists public\.legacy_business_ownership_remediations cascade/i,
    "La migracion final debe retirar el estado persistido de remediacion runtime.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
    /prevent_unsupported_legacy_business_owner_assignment/i,
    "La base debe bloquear ownerless -> owned dentro del runtime del MVP.",
  );
  assert.match(
    legacyRemediationRetirementMigrationSource,
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

  assert.deepEqual(
    localStorageUsageFiles,
    ["components/dashboard/orders-workspace.tsx"],
    `localStorage solo debe existir en frontera de UI no critica: ${localStorageUsageFiles.join(", ")}`,
  );
});
