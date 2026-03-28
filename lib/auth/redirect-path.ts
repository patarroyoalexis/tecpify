export function sanitizeRedirectPath(redirectTo: string | null | undefined) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
}

export function buildLoginHref(redirectTo: string) {
  const safeRedirectPath = sanitizeRedirectPath(redirectTo);
  const searchParams = new URLSearchParams({ redirectTo: safeRedirectPath });
  return `/login?${searchParams.toString()}`;
}
