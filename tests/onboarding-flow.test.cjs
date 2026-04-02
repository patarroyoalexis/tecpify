/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("onboarding: la ruta /onboarding existe y el componente flow esta definido", () => {
  const onboardingPagePath = path.join(process.cwd(), "app/onboarding/page.tsx");
  const onboardingFlowPath = path.join(process.cwd(), "components/onboarding/onboarding-flow.tsx");
  
  assert.ok(fs.existsSync(onboardingPagePath), "El archivo app/onboarding/page.tsx debe existir.");
  assert.ok(fs.existsSync(onboardingFlowPath), "El archivo components/onboarding/onboarding-flow.tsx debe existir.");
});

test("onboarding: el contrato de creacion de negocio incluye businessType", () => {
  const apiRoutePath = path.join(process.cwd(), "app/api/businesses/route.ts");
  const apiContent = fs.readFileSync(apiRoutePath, "utf8");
  
  assert.ok(apiContent.includes("businessType"), "El API de negocios debe manejar businessType.");
  assert.ok(apiContent.includes("business_type"), "El API de negocios debe persistir business_type.");
});

test("onboarding: el slug se genera automaticamente y tiene reintento por colision", () => {
  const apiRoutePath = path.join(process.cwd(), "app/api/businesses/route.ts");
  const apiContent = fs.readFileSync(apiRoutePath, "utf8");
  
  assert.ok(apiContent.includes("finalSlug"), "El API debe usar un slug final calculado.");
  assert.ok(apiContent.includes("Math.random().toString(36)"), "El API debe tener logica de sufijo aleatorio para colisiones.");
});

test("onboarding: la UI de onboarding tiene los campos requeridos", () => {
  const flowPath = path.join(process.cwd(), "components/onboarding/onboarding-flow.tsx");
  const flowContent = fs.readFileSync(flowPath, "utf8");
  
  assert.ok(flowContent.includes("businessName"), "Debe existir campo para nombre del negocio.");
  assert.ok(flowContent.includes("businessType"), "Debe existir campo para tipo de negocio.");
  assert.ok(flowContent.includes("products"), "Debe existir manejo de productos.");
  assert.ok(flowContent.includes("Publicar negocio"), "Debe existir el boton de publicar.");
});
