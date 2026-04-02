/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("onboarding column layout: desktop fija el alto del viewport y reserva el scroll al panel central", () => {
  const pageSource = read("app/onboarding/page.tsx");
  const flowSource = read("components/onboarding/onboarding-flow.tsx");

  assert.match(
    pageSource,
    /lg:h-screen[\s\S]*lg:overflow-hidden/,
    "El contenedor principal debe fijar el alto en desktop y bloquear el scroll de pagina.",
  );
  assert.match(
    flowSource,
    /lg:h-full[\s\S]*lg:min-h-0[\s\S]*lg:grid-cols-\[0\.95fr_minmax\(0,1\.38fr\)_0\.9fr\]/,
    "La grilla desktop debe ocupar todo el alto disponible.",
  );
  assert.match(
    flowSource,
    /lg:flex lg:h-full lg:items-center[\s\S]*Crea tu espacio de pedidos/,
    "La columna izquierda debe quedar centrada en el alto disponible.",
  );
  assert.match(
    flowSource,
    /lg:min-h-0 lg:h-full lg:overflow-y-auto/,
    "La columna central debe ser la unica zona con scroll vertical en desktop.",
  );
  assert.match(
    flowSource,
    /lg:flex lg:h-full lg:items-center/,
    "La columna derecha debe quedar centrada en el alto disponible.",
  );
  assert.match(
    flowSource,
    /Tu progreso/,
    "La tarjeta de progreso debe seguir presente en la columna derecha.",
  );
});
