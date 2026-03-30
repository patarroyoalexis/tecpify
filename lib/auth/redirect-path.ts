export const DEFAULT_PRIVATE_REDIRECT_PATH = "/dashboard";

export function sanitizeRedirectPath(
  redirectTo: string | null | undefined,
  fallbackPath = "/",
) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return fallbackPath;
  }

  return redirectTo;
}

export function sanitizePrivateRedirectPath(redirectTo: string | null | undefined) {
  return sanitizeRedirectPath(redirectTo, DEFAULT_PRIVATE_REDIRECT_PATH);
}

export function buildLoginHref(redirectTo: string) {
  const safeRedirectPath = sanitizeRedirectPath(redirectTo);
  const searchParams = new URLSearchParams({ redirectTo: safeRedirectPath });
  return `/login?${searchParams.toString()}`;
}
