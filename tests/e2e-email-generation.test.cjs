/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  DEFAULT_E2E_TEST_EMAIL_DOMAIN,
  buildE2eTestEmail,
  normalizeE2eTestEmailDomain,
  resolveE2eTestEmailDomain,
  sanitizeE2eEmailLocalPart,
} = loadTsModule("tests/e2e/support/e2e-email.ts");

test("e2e email: centraliza un local-part valido, trazable y en minusculas", () => {
  assert.equal(
    sanitizeE2eEmailLocalPart("Playwright OWNER__Mn9Aretf++fao141"),
    "playwright-owner-mn9aretf-fao141",
  );
});

test("e2e email: valida y normaliza dominios configurados", () => {
  assert.equal(
    normalizeE2eTestEmailDomain(" QA.Tecpify.Dev "),
    "qa.tecpify.dev",
  );
  assert.throws(
    () => normalizeE2eTestEmailDomain("localhost"),
    /dominio real con al menos un punto/i,
  );
});

test("e2e email: usa el dominio configurado o deriva uno seguro desde NEXT_PUBLIC_SITE_URL", () => {
  assert.equal(
    resolveE2eTestEmailDomain({
      configuredDomain: "ops.tecpify.dev",
    }),
    "ops.tecpify.dev",
  );
  assert.equal(
    resolveE2eTestEmailDomain({
      siteUrl: "https://tecpify.vercel.app",
    }),
    "tecpify.vercel.app",
  );
  assert.equal(
    resolveE2eTestEmailDomain({
      siteUrl: "http://localhost:3000",
    }),
    DEFAULT_E2E_TEST_EMAIL_DOMAIN,
  );
});

test("e2e email: genera correos validos, unicos y sin example.com hardcodeado", () => {
  const email = buildE2eTestEmail("owner", {
    configuredDomain: "ops.tecpify.dev",
    uniqueToken: "Mn9Aretf__fao141",
  });

  assert.equal(email, "playwright-owner-mn9aretf-fao141@ops.tecpify.dev");
  assert.doesNotMatch(email, /@example\.com$/i);
});
