const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function assertValidSiteUrl(url: string) {
  try {
    const normalizedUrl = normalizeSiteUrl(url);
    const parsedUrl = new URL(normalizedUrl);

    if (!parsedUrl.protocol.startsWith("http")) {
      throw new Error("invalid_protocol");
    }

    return normalizedUrl;
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL no es valida. Usa una URL completa, por ejemplo https://tecpify.vercel.app o http://localhost:3000.",
    );
  }
}

export function getSiteUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return assertValidSiteUrl(configuredSiteUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_SITE_URL;
  }

  throw new Error(
    "Falta configurar NEXT_PUBLIC_SITE_URL en produccion. Cargala en Vercel con tu dominio publico, por ejemplo https://tecpify.vercel.app.",
  );
}

export function getAuthCallbackUrl(options?: { next?: string | null | undefined }) {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());

  if (options?.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    callbackUrl.searchParams.set("next", options.next);
  }

  return callbackUrl.toString();
}
