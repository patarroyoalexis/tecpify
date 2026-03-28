const LOCAL_SITE_URL = "http://localhost:3000";
const PLAYWRIGHT_FIXTURE_EMAIL_DOMAIN = "example.com";
const MIN_PLAYWRIGHT_E2E_PASSWORD_LENGTH = 12;

function normalizeEnvValue(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readOptionalEnv(name: string) {
  return normalizeEnvValue(process.env[name]);
}

function readRequiredEnv(name: string, value: string | undefined) {
  const normalizedValue = normalizeEnvValue(value);

  if (!normalizedValue) {
    throw new Error(`Missing ${name} environment variable.`);
  }

  return normalizedValue;
}

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function normalizePlaywrightFixtureNamespace(namespace: string) {
  return namespace
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readRequiredPlaywrightFixturePassword() {
  const password = readOptionalEnv("PLAYWRIGHT_E2E_PASSWORD");

  if (!password) {
    throw new Error(
      [
        "Falta PLAYWRIGHT_E2E_PASSWORD para bootstrapear las fixtures seguras de Auth en Playwright.",
        "La suite E2E ya no reutiliza cuentas humanas ni variables PLAYWRIGHT_OWNER_/PLAYWRIGHT_INTRUDER_.",
      ].join(" "),
    );
  }

  if (password.length < MIN_PLAYWRIGHT_E2E_PASSWORD_LENGTH) {
    throw new Error(
      `PLAYWRIGHT_E2E_PASSWORD debe tener al menos ${MIN_PLAYWRIGHT_E2E_PASSWORD_LENGTH} caracteres para evitar credenciales fragiles en la suite E2E.`,
    );
  }

  return password;
}

function getSupabaseProjectRefFromUrl(url: string) {
  const hostname = new URL(url).hostname;
  const projectRef = hostname.split(".")[0]?.trim();

  if (!projectRef) {
    throw new Error(
      "No fue posible derivar el project ref de Supabase desde NEXT_PUBLIC_SUPABASE_URL para las fixtures E2E.",
    );
  }

  return projectRef;
}

function resolvePlaywrightFixtureNamespace(operationalEnv: OperationalEnv) {
  const configuredNamespace = readOptionalEnv("PLAYWRIGHT_E2E_NAMESPACE");
  const rawNamespace =
    configuredNamespace ?? getSupabaseProjectRefFromUrl(operationalEnv.nextPublicSupabaseUrl);
  const normalizedNamespace = normalizePlaywrightFixtureNamespace(rawNamespace);

  if (!normalizedNamespace) {
    throw new Error(
      [
        "PLAYWRIGHT_E2E_NAMESPACE no es valida despues de normalizarla.",
        "Usa solo letras, numeros o separadores simples para aislar tus fixtures E2E.",
      ].join(" "),
    );
  }

  return normalizedNamespace;
}

function buildPlaywrightFixtureEmail(role: PlaywrightAuthFixtureRole, namespace: string) {
  return `playwright-${role}+${namespace}@${PLAYWRIGHT_FIXTURE_EMAIL_DOMAIN}`;
}

function buildPlaywrightAuthFixtures(operationalEnv: OperationalEnv): PlaywrightAuthFixtures {
  const namespace = resolvePlaywrightFixtureNamespace(operationalEnv);
  const password = readRequiredPlaywrightFixturePassword();

  return {
    namespace,
    owner: {
      role: "owner",
      email: buildPlaywrightFixtureEmail("owner", namespace),
      password,
    },
    intruder: {
      role: "intruder",
      email: buildPlaywrightFixtureEmail("intruder", namespace),
      password,
    },
  };
}

function assertValidHttpUrl(name: string, value: string) {
  const normalizedUrl = normalizeSiteUrl(value);

  try {
    const parsedUrl = new URL(normalizedUrl);

    if (!parsedUrl.protocol.startsWith("http")) {
      throw new Error("invalid_protocol");
    }

    return normalizedUrl;
  } catch {
    throw new Error(
      `${name} no es valida. Usa una URL completa, por ejemplo https://tecpify.vercel.app o http://localhost:3000.`,
    );
  }
}

export interface OperationalEnv {
  nextPublicSupabaseUrl: string;
  nextPublicSupabaseAnonKey: string;
}

export interface PlaywrightEnv {
  baseUrl: string;
  skipWebServer: boolean;
  isCi: boolean;
  authFixtures: PlaywrightAuthFixtures;
}

export type PlaywrightAuthFixtureRole = "owner" | "intruder";

export interface PlaywrightAuthFixtureUser {
  role: PlaywrightAuthFixtureRole;
  email: string;
  password: string;
}

export interface PlaywrightAuthFixtures {
  namespace: string;
  owner: PlaywrightAuthFixtureUser;
  intruder: PlaywrightAuthFixtureUser;
}

let cachedOperationalEnv: OperationalEnv | null = null;
let cachedPlaywrightEnv: PlaywrightEnv | null = null;

export function getOperationalEnv(): OperationalEnv {
  if (cachedOperationalEnv) {
    return cachedOperationalEnv;
  }

  cachedOperationalEnv = {
    nextPublicSupabaseUrl: readRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    nextPublicSupabaseAnonKey: readRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };

  return cachedOperationalEnv;
}

export function getSiteUrlEnv() {
  const configuredSiteUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredSiteUrl) {
    return assertValidHttpUrl("NEXT_PUBLIC_SITE_URL", configuredSiteUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_SITE_URL;
  }

  throw new Error(
    "Falta configurar NEXT_PUBLIC_SITE_URL en produccion. Cargala en Vercel con tu dominio publico, por ejemplo https://tecpify.vercel.app.",
  );
}

export function getNodeEnv() {
  return process.env.NODE_ENV ?? "development";
}

export function isProductionEnvironment() {
  return getNodeEnv() === "production";
}

export function isDevelopmentEnvironment() {
  return !isProductionEnvironment();
}

export function getPlaywrightEnv(): PlaywrightEnv {
  if (cachedPlaywrightEnv) {
    return cachedPlaywrightEnv;
  }

  const operationalEnv = getOperationalEnv();
  const configuredBaseUrl = readOptionalEnv("PLAYWRIGHT_BASE_URL");

  cachedPlaywrightEnv = {
    baseUrl: configuredBaseUrl ? assertValidHttpUrl("PLAYWRIGHT_BASE_URL", configuredBaseUrl) : LOCAL_SITE_URL,
    skipWebServer: readOptionalEnv("PLAYWRIGHT_SKIP_WEBSERVER") === "1",
    isCi: Boolean(readOptionalEnv("CI")),
    authFixtures: buildPlaywrightAuthFixtures(operationalEnv),
  };

  return cachedPlaywrightEnv;
}

export function getPlaywrightAuthFixtures() {
  return getPlaywrightEnv().authFixtures;
}
