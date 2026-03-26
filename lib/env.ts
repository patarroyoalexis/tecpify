const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeEnvValue(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : undefined;
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

let cachedOperationalEnv: OperationalEnv | null = null;

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
