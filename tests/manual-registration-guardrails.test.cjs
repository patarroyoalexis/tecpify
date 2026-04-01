/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("manual register: el runtime visible lo mantiene como carril secundario y no como CTA principal", () => {
  const landingSource = read("components/home/landing-page.tsx");
  const navbarSource = read("components/layout/app-navbar.tsx");
  const footerSource = read("components/layout/app-footer.tsx");
  const loginFormSource = read("components/auth/login-form.tsx");
  const registerPageSource = read("app/register/page.tsx");
  const registerFormSource = read("components/auth/register-form.tsx");
  const registerRouteSource = read("app/api/auth/register/route.ts");

  assert.match(
    landingSource,
    /const primaryHref = isAuthenticated \? "\/ajustes" : "\/login\?redirectTo=\/ajustes";/,
    "La landing no debe mandar usuarios anonimos al registro manual como CTA principal.",
  );
  assert.match(
    landingSource,
    /carril secundario/i,
    "La landing debe dejar visible que el registro manual es un carril secundario.",
  );
  assert.match(
    navbarSource,
    /Registro manual/,
    "La navegacion publica debe etiquetar el signup como registro manual y no como alta oficial cerrada.",
  );
  assert.doesNotMatch(
    navbarSource,
    /Crear mi negocio|Crear cuenta/,
    "La navegacion publica no debe seguir promocionando el registro manual como CTA principal.",
  );
  assert.match(
    footerSource,
    /Registro manual secundario/i,
    "El footer debe mantener el registro manual como acceso secundario.",
  );
  assert.match(
    loginFormSource,
    /login-register-secondary-link[\s\S]*carril secundario/i,
    "El login debe presentar el registro manual solo como salida secundaria.",
  );
  assert.match(
    registerPageSource,
    /Carril secundario[\s\S]*circuito garantizado del MVP[\s\S]*solo desde \/login/i,
    "La pagina de registro debe advertir que no pertenece al circuito garantizado.",
  );
  assert.match(
    registerFormSource,
    /register-secondary-warning[\s\S]*solo desde \/login[\s\S]*Intentar registro manual/i,
    "El formulario de registro debe advertir en runtime que el flujo es secundario y que Google no vive en este carril.",
  );
  assert.doesNotMatch(
    registerFormSource,
    /register-google-auth-link|AuthGoogleButton/,
    "El carril manual no debe conservar un CTA paralelo de Google.",
  );
  assert.match(
    registerRouteSource,
    /requiresEmailConfirmation:\s*true[\s\S]*Revisa tu correo/i,
    "La API de registro debe seguir siendo honesta cuando depende de confirmacion por email.",
  );
});

test("manual register: README, AGENTS y env example quedan alineados con la decision B", () => {
  const readmeSource = read("README.md");
  const agentsSource = read("AGENTS.md");
  const envExampleSource = read(".env.example");

  assert.match(
    readmeSource,
    /registro manual[\s\S]*carril secundario\/no garantizado/i,
    "README.md debe documentar que el registro manual queda fuera del frente cerrado.",
  );
  assert.match(
    agentsSource,
    /registro manual[\s\S]*carril secundario\/no garantizado/i,
    "AGENTS.md debe fijar el mismo alcance runtime del registro manual.",
  );
  assert.match(
    envExampleSource,
    /solo como opcion secundaria en \/login/i,
    ".env.example debe dejar claro que Google no reabre el carril de register.",
  );
  assert.doesNotMatch(
    readmeSource,
    /registro existe en runtime pero todavia no tiene el mismo cierre E2E|Registro y Google OAuth opcional siguen parciales/i,
    "README.md no puede seguir hablando del registro manual como frente ambiguo a medio cerrar.",
  );
  assert.doesNotMatch(
    agentsSource,
    /El registro existe en runtime[\s\S]*no existe evidencia E2E equivalente|Registro y Google OAuth opcional:/i,
    "AGENTS.md no puede dejar el registro manual en una zona gris despues de despromoverlo.",
  );
});
