/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const readmeSource = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const agentsSource = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
const envExampleSource = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");

test("docs admin: README y AGENTS documentan roles validos y separacion entre dashboard y /admin", () => {
  assert.match(readmeSource, /platform_admin/i);
  assert.match(readmeSource, /business_owner/i);
  assert.match(readmeSource, /customer/i);
  assert.match(readmeSource, /`\/dashboard`[\s\S]*selector|entrada privada/i);
  assert.match(readmeSource, /`\/admin`[\s\S]*solo para `platform_admin`/i);
  assert.match(readmeSource, /asignar `platform_admin`|upsert_user_profile_role_by_email/i);
  assert.match(readmeSource, /GMV[\s\S]*excluye pedidos cancelados y fiados? pendientes/i);
  assert.match(readmeSource, /funnel|embudo[\s\S]*no inventa eventos/i);

  assert.match(agentsSource, /platform_admin/i);
  assert.match(agentsSource, /business_owner/i);
  assert.match(agentsSource, /customer/i);
  assert.match(agentsSource, /`\/admin`[\s\S]*solo para `platform_admin`/i);
  assert.match(agentsSource, /`\/dashboard`[\s\S]*no mezcla metricas de plataforma/i);
  assert.match(agentsSource, /user_profiles|app_role/i);
});

test("docs admin: .env.example sigue sin introducir variables nuevas para roles runtime", () => {
  assert.doesNotMatch(
    envExampleSource,
    /\bPLATFORM_ADMIN_|APP_ROLE_|USER_ROLE_/,
    ".env.example no debe introducir flags ambiguas de rol en runtime normal.",
  );
  assert.match(
    envExampleSource,
    /\bPLAYWRIGHT_E2E_PASSWORD\b/,
    "El bootstrap E2E admin debe seguir dependiendo del secreto unico ya documentado.",
  );
});
