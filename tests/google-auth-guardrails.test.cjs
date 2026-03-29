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

test("google auth: el flag opcional del entorno permanece deshabilitado por defecto, acepta booleanos validos y controla el href secundario", () => {
  withPatchedEnv(
    {
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: undefined,
    },
    () => {
      const envModule = loadTsModule("lib/env.ts");
      const googleAuthModule = loadTsModule("lib/auth/google-auth.ts");
      assert.equal(envModule.getOperationalEnv().nextPublicGoogleAuthEnabled, false);
      assert.equal(googleAuthModule.getGoogleAuthHref({ redirectTo: "/dashboard" }), null);
    },
  );

  withPatchedEnv(
    {
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
    },
    () => {
      const envModule = loadTsModule("lib/env.ts");
      const googleAuthModule = loadTsModule("lib/auth/google-auth.ts");
      assert.equal(envModule.getOperationalEnv().nextPublicGoogleAuthEnabled, true);
      assert.equal(
        googleAuthModule.getGoogleAuthHref({ redirectTo: "/dashboard" }),
        "/api/auth/oauth/google?redirectTo=%2Fdashboard",
      );
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

test("google auth: el helper mantiene Google acotado a login y sanea redirectTo antes de iniciar OAuth", () => {
  const googleAuthModule = loadTsModule("lib/auth/google-auth.ts");

  assert.equal(
    googleAuthModule.buildGoogleAuthStartHref(),
    "/api/auth/oauth/google?redirectTo=%2F",
  );
  assert.equal(
    googleAuthModule.buildGoogleAuthStartHref({
      redirectTo: "https://evil.example.com/steal",
    }),
    "/api/auth/oauth/google?redirectTo=%2F",
  );
  assert.equal(googleAuthModule.getGoogleAuthEntryPath(), "/login");
});

test("google auth: la nueva frontera runtime inicia Google solo desde cliente anon/SSR normal y lo acota a /login", () => {
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
    "La frontera runtime debe pedir la URL de OAuth sin dejar la redireccion implicita a la UI.",
  );
  assert.match(
    routeSource,
    /sanitizeRedirectPath/,
    "La frontera runtime debe sanear redirectTo antes de construir el callback OAuth.",
  );
  assert.match(
    routeSource,
    /getAuthCallbackUrl\(\{\s*next:\s*redirectTo\s*\}\)/,
    "Google OAuth debe reutilizar el callback canonico del auth flow sin abrir una rama paralela de register.",
  );
  assert.match(
    routeSource,
    /getGoogleAuthEntryPath/,
    "Google OAuth debe redirigir de vuelta al acceso secundario de login.",
  );
  assert.doesNotMatch(
    routeSource,
    /parseAuthEntryIntent|intent:/,
    "La ruta de inicio de Google no debe conservar una rama muerta para register.",
  );
  assert.doesNotMatch(
    routeSource,
    /\bSUPABASE_SERVICE_ROLE_KEY\b|createInternalServiceRoleSupabaseClient|createServerSupabaseAdminClient/,
    "Google OAuth no puede reintroducir service role en el runtime normal.",
  );
});

test("google auth: el callback bloquea code OAuth cuando la flag esta apagada y conserva verifyOtp para confirmaciones no OAuth", () => {
  const callbackSource = fs.readFileSync(
    path.join(repoRoot, "app", "auth", "callback", "route.ts"),
    "utf8",
  );

  assert.match(
    callbackSource,
    /if \(code\) \{[\s\S]*!isGoogleAuthEnabled\(\)[\s\S]*google_auth_unavailable/,
    "El callback debe rechazar codigos OAuth directos cuando Google no esta habilitado.",
  );
  assert.match(
    callbackSource,
    /exchangeCodeForSession/,
    "El callback debe seguir cerrando el intercambio de codigo OAuth dentro de la frontera auth normal.",
  );
  assert.doesNotMatch(
    callbackSource,
    /parseAuthEntryIntent|getAuthEntryPath/,
    "El callback no debe conservar una rama muerta para register despues de acotar Google a login.",
  );
  assert.match(
    callbackSource,
    /verifyOtp/,
    "El callback no debe romper la confirmacion manual por token_hash.",
  );
});

test("google auth: la UI mantiene email/password como camino base y no expone Google desde register", () => {
  const loginPageSource = fs.readFileSync(
    path.join(repoRoot, "app", "login", "page.tsx"),
    "utf8",
  );
  const loginFormSource = fs.readFileSync(
    path.join(repoRoot, "components", "auth", "login-form.tsx"),
    "utf8",
  );
  const registerPageSource = fs.readFileSync(
    path.join(repoRoot, "app", "register", "page.tsx"),
    "utf8",
  );
  const registerFormSource = fs.readFileSync(
    path.join(repoRoot, "components", "auth", "register-form.tsx"),
    "utf8",
  );

  assert.match(
    loginPageSource,
    /getGoogleAuthHref/,
    "La pagina de login debe resolver el carril opcional desde un helper centralizado.",
  );
  assert.match(
    loginFormSource,
    /login-submit-button[\s\S]*login-google-auth-link/,
    "Email/password debe seguir apareciendo antes del CTA secundario de Google.",
  );
  assert.match(
    loginFormSource,
    /login-google-auth-secondary-copy[\s\S]*Google es opcional en este entorno/i,
    "La UI de login debe explicitar que Google es un carril opcional/secundario.",
  );
  assert.match(
    registerPageSource,
    /Google[\s\S]*solo desde \/login/i,
    "La pagina de register debe dejar claro que Google, si existe, se intenta solo desde login.",
  );
  assert.match(
    registerFormSource,
    /solo desde \/login/i,
    "El formulario de register debe mantener Google fuera del carril manual.",
  );
  assert.doesNotMatch(
    registerFormSource,
    /register-google-auth-link|AuthGoogleButton/,
    "Register no debe renderizar un CTA propio de Google OAuth.",
  );
});
