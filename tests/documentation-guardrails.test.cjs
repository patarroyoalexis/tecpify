/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

const README_CONTRACT_HEADING = "## 11.1 Contrato verificable del MVP";
const AGENTS_CONTRACT_HEADING =
  "### Regla bloqueante de fuente de verdad y fronteras client/server";

const README_CONTRACT_ITEMS = [
  "Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.",
  "`localStorage` solo puede guardar estado de UI no critico.",
  "El canon server/API resuelve ownership desde sesion/contexto confiable; no acepta `owner_id`, `created_by_user_id` ni `business_id` del cliente como autoridad.",
  "Los negocios legacy sin owner solo salen de `ownerless_*` mediante remediacion auditable y siguen inaccesibles hasta persistir `businesses.created_by_user_id`.",
  "La creacion de pedidos solo toma datos editables; cualquier `status`, `paymentStatus` o metadato derivable enviado por cliente se ignora y el servidor deriva el estado segun el medio de pago y el origen.",
  "`lib/supabase/server.ts` solo expone clientes `public` y `auth`.",
  "`SUPABASE_SERVICE_ROLE_KEY` no participa en el runtime normal del MVP.",
  "Toda lectura de `process.env` debe vivir en `lib/env.ts`.",
];

const AGENTS_CONTRACT_ITEMS = [
  "Supabase es la fuente de verdad para negocios, productos y pedidos del MVP.",
  "`localStorage` solo puede guardar estado de UI no critico.",
  "El server debe resolver ownership desde sesion/contexto confiable y no confiar en `owner_id`, `created_by_user_id` ni `business_id` enviados por cliente para autorizar o mutar recursos.",
  "Los negocios legacy sin owner solo salen de `ownerless_*` mediante remediacion auditable y siguen inaccesibles hasta persistir `businesses.created_by_user_id`.",
  "La creacion de pedidos debe tomar solo datos editables; cualquier `status`, `paymentStatus` o metadato derivable enviado por cliente se ignora y el server deriva el estado segun medio de pago y origen.",
  "`README.md` y `AGENTS.md` deben describir solo flujos realmente activos en el repo.",
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getContractSectionBulletItems(relativePath, heading) {
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

test("documentacion: README y AGENTS mantienen sus secciones contractuales canonicas", () => {
  assert.deepEqual(
    getContractSectionBulletItems("README.md", README_CONTRACT_HEADING).sort(),
    [...README_CONTRACT_ITEMS].sort(),
    "README.md debe mantener exactamente el bloque canonico del MVP.",
  );
  assert.deepEqual(
    getContractSectionBulletItems("AGENTS.md", AGENTS_CONTRACT_HEADING).sort(),
    [...AGENTS_CONTRACT_ITEMS].sort(),
    "AGENTS.md debe mantener exactamente el bloque canonico del guardian.",
  );
});

test("documentacion: las afirmaciones contractuales siguen alineadas con el codigo real", () => {
  const businessesApiSource = readFile("app/api/businesses/route.ts");
  const productsApiSource = readFile("app/api/products/route.ts");
  const productByIdApiSource = readFile("app/api/products/[productId]/route.ts");
  const ordersApiSource = readFile("app/api/orders/route.ts");
  const workspaceOrdersApiSource = readFile("app/api/orders/private/route.ts");
  const orderByIdApiSource = readFile("app/api/orders/[orderId]/route.ts");
  const legacyRemediationRequestApiSource = readFile(
    "app/api/businesses/legacy-remediation/request/route.ts",
  );
  const legacyRemediationClaimApiSource = readFile(
    "app/api/businesses/legacy-remediation/claim/route.ts",
  );
  const supabaseServerSource = readFile("lib/supabase/server.ts");
  const businessesDataSource = readFile("data/businesses.ts");
  const legacyRemediationDataSource = readFile("lib/data/business-ownership-remediation.ts");
  const productsDataSource = readFile("lib/data/products.ts");
  const ordersDataSource = readFile("lib/data/orders-server.ts");
  const orderStateRulesSource = readFile("lib/orders/state-rules.ts");
  const legacyRemediationMigrationSource = readFile(
    "supabase/migrations/20260326_add_legacy_business_ownership_remediation.sql",
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
    /source:\s*"storefront"/,
    "La creacion publica de pedidos debe declararse explicitamente como flujo storefront server-side.",
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
    /source:\s*"workspace"/,
    "La creacion manual de pedidos debe declararse explicitamente como flujo autenticado.",
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
    legacyRemediationRequestApiSource,
    /requireAuthenticatedApiUser/,
    "La solicitud de remediacion legacy debe exigir sesion autenticada.",
  );
  assert.match(
    legacyRemediationClaimApiSource,
    /requireAuthenticatedApiUser/,
    "El claim de remediacion legacy debe exigir sesion autenticada.",
  );
  assert.match(
    supabaseServerSource,
    /keySource:\s*"NEXT_PUBLIC_SUPABASE_ANON_KEY"/,
    "lib/supabase/server.ts debe seguir usando la anon key en flujo normal.",
  );
  assert.match(
    supabaseServerSource,
    /isUsingServiceRole:\s*false/,
    "lib/supabase/server.ts no debe declarar uso de service role en flujo normal.",
  );
  assert.match(
    businessesDataSource,
    /createServerSupabasePublicClient/,
    "La resolucion publica del storefront debe seguir pasando por el cliente publico de Supabase.",
  );
  assert.match(
    businessesDataSource,
    /listCurrentUserLegacyBusinessOwnershipRemediations/,
    "La home operativa debe exponer el estado de remediacion legacy para la sesion autenticada.",
  );
  assert.match(
    legacyRemediationDataSource,
    /createServerSupabaseAuthClient/,
    "La remediacion legacy debe operar con cliente autenticado SSR y no con service role.",
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
    /resolveAuthoritativeOrderStatePatch/,
    "La mutacion de pedidos debe pasar por el resolvedor central de estado y pago.",
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
    /resolveAuthoritativeOrderStatePatch/,
    "El nucleo de reglas debe resolver y validar el snapshot autoritativo del PATCH.",
  );
  assert.match(
    legacyRemediationMigrationSource,
    /create table if not exists public\.legacy_business_ownership_remediations/i,
    "La remediacion legacy debe persistir su estado en tabla dedicada.",
  );
  assert.match(
    legacyRemediationMigrationSource,
    /create table if not exists public\.legacy_business_ownership_remediation_events/i,
    "La remediacion legacy debe dejar evidencia auditable en eventos persistidos.",
  );
  assert.match(
    legacyRemediationMigrationSource,
    /businesses_require_legacy_remediation_before_owner_assignment/i,
    "La base debe bloquear asignaciones legacy sin remediacion claimable.",
  );
  assert.match(
    legacyRemediationMigrationSource,
    /grant_legacy_business_owner_claim/i,
    "La remediacion legacy debe conservar un paso de habilitacion controlada para el claim.",
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
