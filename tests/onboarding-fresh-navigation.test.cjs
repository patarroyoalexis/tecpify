/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("onboarding fresh navigation: login no prefetchea /onboarding y fuerza una navegacion fresca", () => {
  const loginFormSource = read("components/auth/login-form.tsx");

  assert.match(
    loginFormSource,
    /href="\/onboarding"[\s\S]*prefetch=\{false\}/,
    "El link visible a /onboarding no debe prefetchearse.",
  );
  assert.match(
    loginFormSource,
    /destination === "\/onboarding"[\s\S]*window\.location\.assign\(destination\)/,
    "La navegacion post-auth hacia /onboarding debe evitar el cache del App Router.",
  );
});

test("onboarding fresh navigation: register usa la misma salida fresca hacia /onboarding", () => {
  const registerFormSource = read("components/auth/register-form.tsx");

  assert.match(
    registerFormSource,
    /destination === "\/onboarding"[\s\S]*window\.location\.assign\(destination\)/,
    "El registro manual debe evitar reutilizar un payload prefetched al entrar a /onboarding.",
  );
});
