/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const metricsSpecPath = path.join(repoRoot, "tests", "e2e", "private-metrics.spec.ts");
const readmePath = path.join(repoRoot, "README.md");
const agentsPath = path.join(repoRoot, "AGENTS.md");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("private metrics e2e: existe una spec dedicada y no superficial", () => {
  assert.equal(
    fs.existsSync(metricsSpecPath),
    true,
    "El repo debe conservar una spec E2E dedicada para metricas privadas.",
  );

  const metricsSpecSource = readFile(metricsSpecPath);

  assert.match(
    metricsSpecSource,
    /\/metricas\/\$\{primaryScenario\.businessSlug\}/,
    "La spec debe abrir la ruta privada real de metricas del negocio owner.",
  );
  assert.match(
    metricsSpecSource,
    /unauthorized-business-access/,
    "La spec debe cubrir el bloqueo o aislamiento frente a otro usuario autenticado.",
  );
  assert.match(
    metricsSpecSource,
    /createManualOrderThroughPrivateApi/,
    "La spec debe preparar pedidos reales persistidos y no depender de mocks de UI.",
  );
  assert.match(
    metricsSpecSource,
    /metrics-pending-fiado-banner|pendingFiadoCount/,
    "La spec debe verificar la exclusion del fiado pendiente de ingresos efectivos.",
  );
  assert.match(
    metricsSpecSource,
    /localStorage\.length/,
    "La spec debe demostrar que el resultado no depende de localStorage.",
  );
  assert.match(
    metricsSpecSource,
    /cutoffRevenue:\s*80_000/,
    "La spec debe validar calculos concretos del corte y no solo que la pagina carga.",
  );
});

test("private metrics e2e: la documentacion refleja el cierre real sobre Supabase enlazado", () => {
  const readmeSource = readFile(readmePath);
  const agentsSource = readFile(agentsPath);

  assert.match(
    readmeSource,
    /metricas.*evidencia E2E real.*Supabase enlazado/i,
    "README.md debe describir el cierre real de metricas privadas sobre el Supabase enlazado.",
  );
  assert.match(
    agentsSource,
    /metricas privadas.*quedan cerradas/i,
    "AGENTS.md debe dejar claro que el frente de metricas privadas ya quedo cerrado.",
  );
  assert.doesNotMatch(
    readmeSource,
    /todavia sin una spec E2E dedicada|suite E2E todavia no cubre metricas privadas/i,
    "README.md no puede seguir diciendo que no existe una spec dedicada despues de agregarla.",
  );
  assert.doesNotMatch(
    agentsSource,
    /no tienen una validacion E2E dedicada|frente sigue abierto hasta que el proyecto Supabase apuntado por Playwright/i,
    "AGENTS.md no puede seguir describiendo metricas privadas como un frente abierto por drift.",
  );
});
