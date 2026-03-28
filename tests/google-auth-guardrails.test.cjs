/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();

function withPatchedEnv(overrides, callback) {
  const previousValues = {};

  for (const [name, value] of Object.entries(overrides)) {
    previousValues[name] = process.env[name];

    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    callback();
  } finally {
    for (const [name, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test("google auth: el flag opcional del entorno permanece deshabilitado por defecto y acepta booleanos validos", () => {
  withPatchedEnv(
    {
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: undefined,
    },
    () => {
      const envModule = loadTsModule("lib/env.ts");
      assert.equal(envModule.getOperationalEnv().nextPublicGoogleAuthEnabled, false);
    },
  );

  withPatchedEnv(
    {
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
    },
    () => {
      const envModule = loadTsModule("lib/env.ts");
      assert.equal(envModule.getOperationalEnv().nextPublicGoogleAuthEnabled, true);
    },
  );

  withPatchedEnv(
    {
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "nope",
    },
    () => {
      const envModule = loadTsModule("lib/env.ts");
      assert.throws(
        () => envModule.getOperationalEnv(),
        /NEXT_PUBLIC_GOOGLE_AUTH_ENABLED no es valida/i,
      );
    },
  );
});

test("google auth: el helper mantiene login como default y sanea redirectTo antes de iniciar OAuth", () => {
  const googleAuthModule = loadTsModule("lib/auth/google-auth.ts");

  assert.equal(
    googleAuthModule.buildGoogleAuthStartHref(),
    "/api/auth/oauth/google?redirectTo=%2F&intent=login",
  );
  assert.equal(
    googleAuthModule.buildGoogleAuthStartHref({
      redirectTo: "https://evil.example.com/steal",
      intent: "register",
    }),
    "/api/auth/oauth/google?redirectTo=%2F&intent=register",
  );
  assert.equal(googleAuthModule.parseAuthEntryIntent("register"), "register");
  assert.equal(googleAuthModule.parseAuthEntryIntent("otra-cosa"), "login");
});

test("google auth: la nueva frontera runtime inicia Google solo desde cliente anon/SSR normal y reutiliza el callback canónico", () => {
  const routeSource = fs.readFileSync(
    path.join(repoRoot, "app", "api", "auth", "oauth", "google", "route.ts"),
    "utf8",
  );

  assert.match(
    routeSource,
    /createServerSupabaseAuthClient/,
    "El inicio de Google OAuth debe usar el cliente SSR/auth normal de Supabase.",
  );
  assert.match(
    routeSource,
    /signInWithOAuth/,
    "La frontera runtime debe iniciar el flujo OAuth con Supabase Auth.",
  );
  assert.match(
    routeSource,
    /provider:\s*"google"/,
    "La frontera runtime debe fijar Google como provider explicito.",
  );
  assert.match(
    routeSource,
    /skipBrowserRedirect:\s*true/,
    "La frontera runtime debe pedir la URL de OAuth sin dejar la redireccion implícita a la UI.",
  );
  assert.match(
    routeSource,
    /sanitizeRedirectPath/,
    "La frontera runtime debe sanear redirectTo antes de construir el callback OAuth.",
  );
  assert.match(
    routeSource,
    /getAuthCallbackUrl/,
    "Google OAuth debe reutilizar el callback canonico del auth flow.",
  );
  assert.doesNotMatch(
    routeSource,
    /\bSUPABASE_SERVICE_ROLE_KEY\b|createInternalServiceRoleSupabaseClient|createServerSupabaseAdminClient/,
    "Google OAuth no puede reintroducir service role en el runtime normal.",
  );
});
