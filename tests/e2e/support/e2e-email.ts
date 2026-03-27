import { getPlaywrightEnv, getSiteUrlEnv } from "../../../lib/env";

export const DEFAULT_E2E_TEST_EMAIL_DOMAIN = "gmail.com";

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_HOST_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function buildGeneratedSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeE2eEmailLocalPart(value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedValue) {
    throw new Error("No fue posible construir un local-part valido para el email E2E.");
  }

  return normalizedValue.slice(0, 64).replace(/-+$/g, "");
}

export function normalizeE2eTestEmailDomain(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase().replace(/\.+$/g, "");
  const labels = normalizedDomain.split(".").filter((label) => label.length > 0);

  if (labels.length < 2) {
    throw new Error(
      `E2E_TEST_EMAIL_DOMAIN debe ser un dominio real con al menos un punto. Recibimos "${domain}".`,
    );
  }

  if (normalizedDomain.includes("..")) {
    throw new Error(
      `E2E_TEST_EMAIL_DOMAIN no puede contener etiquetas vacias. Recibimos "${domain}".`,
    );
  }

  if (normalizedDomain === "localhost" || IPV4_HOST_PATTERN.test(normalizedDomain)) {
    throw new Error(
      `E2E_TEST_EMAIL_DOMAIN debe ser un dominio de correo valido, no un host local. Recibimos "${domain}".`,
    );
  }

  for (const label of labels) {
    if (!DOMAIN_LABEL_PATTERN.test(label)) {
      throw new Error(
        `E2E_TEST_EMAIL_DOMAIN contiene una etiqueta invalida ("${label}") en "${domain}".`,
      );
    }
  }

  if (!/^[a-z]{2,63}$/.test(labels.at(-1) ?? "")) {
    throw new Error(
      `E2E_TEST_EMAIL_DOMAIN debe terminar en un TLD alfabetico valido. Recibimos "${domain}".`,
    );
  }

  return normalizedDomain;
}

function deriveDomainFromSiteUrl(siteUrl: string) {
  const hostname = new URL(siteUrl).hostname.trim().toLowerCase();

  if (!hostname || hostname === "localhost" || IPV4_HOST_PATTERN.test(hostname)) {
    return null;
  }

  if (!hostname.includes(".")) {
    return null;
  }

  return normalizeE2eTestEmailDomain(hostname);
}

export function resolveE2eTestEmailDomain(options?: {
  configuredDomain?: string | null | undefined;
  siteUrl?: string | null | undefined;
}) {
  const configuredDomain = options?.configuredDomain ?? getPlaywrightEnv().testEmailDomain;

  if (configuredDomain) {
    return normalizeE2eTestEmailDomain(configuredDomain);
  }

  const derivedDomain = deriveDomainFromSiteUrl(options?.siteUrl ?? getSiteUrlEnv());

  if (derivedDomain) {
    return derivedDomain;
  }

  return DEFAULT_E2E_TEST_EMAIL_DOMAIN;
}

export function buildE2eTestEmail(
  role: "owner" | "intruder",
  options?: {
    configuredDomain?: string | null | undefined;
    siteUrl?: string | null | undefined;
    uniqueToken?: string | undefined;
  },
) {
  const emailDomain = resolveE2eTestEmailDomain(options);
  const uniqueToken = options?.uniqueToken ?? buildGeneratedSuffix();
  const localPart = sanitizeE2eEmailLocalPart(`playwright-${role}-${uniqueToken}`);

  return `${localPart}@${emailDomain}`;
}
