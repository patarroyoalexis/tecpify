/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const e2eRoot = path.join(repoRoot, "tests", "e2e");
const E2E_SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const FORBIDDEN_E2E_PATTERNS = [
  { label: "registro runtime", pattern: /["'`]\/api\/auth\/register["'`]/ },
  { label: "supabase signUp", pattern: /\bsignUp\s*\(/ },
  { label: "otp login", pattern: /\bsignInWithOtp\s*\(/ },
  { label: "password reset", pattern: /\bresetPasswordForEmail\s*\(/ },
  { label: "resend auth", pattern: /\bresend(?:Otp)?\s*\(/ },
  { label: "magic link", pattern: /\bmagic[_ -]?link\b/i },
  { label: "verify otp", pattern: /\bverifyOtp\s*\(/ },
  {
    label: "bootstrap privilegiado de usuarios",
    pattern: /\bauth\.admin\.(?:createUser|inviteUserByEmail|generateLink)\b/,
  },
  { label: "emails E2E generados", pattern: /\bbuildE2eTestEmail\b/ },
];

function collectSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }

    if (E2E_SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

function toRelativePath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

test("playwright e2e: el soporte no puede crear usuarios ni disparar flujos de email de auth", () => {
  const files = collectSourceFiles(e2eRoot);

  assert.ok(files.length > 0, "Esperabamos encontrar archivos fuente en tests/e2e.");

  for (const absolutePath of files) {
    const relativePath = toRelativePath(absolutePath);
    const source = fs.readFileSync(absolutePath, "utf8");

    for (const forbiddenPattern of FORBIDDEN_E2E_PATTERNS) {
      assert.doesNotMatch(
        source,
        forbiddenPattern.pattern,
        `${relativePath} no debe contener ${forbiddenPattern.label}.`,
      );
    }
  }
});

test("docs e2e: el contrato documenta bootstrap seguro sin cuentas humanas ni correos", () => {
  const readmeSource = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  const envExampleSource = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");
  const globalSetupPath = path.join(repoRoot, "tests", "helpers", "playwright-global-setup.ts");

  assert.doesNotMatch(
    readmeSource,
    /si esas credenciales no existen,\s+la suite crea usuarios/i,
    "README.md no puede prometer creacion automatica de usuarios E2E.",
  );
  assert.doesNotMatch(
    envExampleSource,
    /intenta registrar usuarios unicos via \/api\/auth\/register/i,
    ".env.example no puede sugerir que Playwright registra usuarios nuevos.",
  );
  assert.doesNotMatch(
    readmeSource,
    /\bPLAYWRIGHT_OWNER_EMAIL\b|\bPLAYWRIGHT_OWNER_PASSWORD\b|\bPLAYWRIGHT_INTRUDER_EMAIL\b|\bPLAYWRIGHT_INTRUDER_PASSWORD\b/,
    "README.md no debe documentar el contrato fragil de cuentas humanas reutilizables.",
  );
  assert.doesNotMatch(
    envExampleSource,
    /\bPLAYWRIGHT_OWNER_EMAIL\b|\bPLAYWRIGHT_OWNER_PASSWORD\b|\bPLAYWRIGHT_INTRUDER_EMAIL\b|\bPLAYWRIGHT_INTRUDER_PASSWORD\b/,
    ".env.example no debe exponer el contrato fragil de cuatro credenciales humanas.",
  );
  assert.match(
    readmeSource,
    /bootstrap(?:ea|ear)?.*fixtures.*Auth/i,
    "README.md debe documentar el bootstrap seguro de fixtures de Auth para Playwright.",
  );
  assert.match(
    envExampleSource,
    /\bPLAYWRIGHT_E2E_PASSWORD\b/,
    ".env.example debe documentar el secreto unico usado para bootstrapear fixtures E2E.",
  );
  assert.equal(
    fs.existsSync(globalSetupPath),
    true,
    "La suite Playwright debe tener un global setup dedicado para bootstrapear fixtures antes de correr specs.",
  );
});
