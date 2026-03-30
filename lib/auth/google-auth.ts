import { sanitizePrivateRedirectPath } from "@/lib/auth/redirect-path";
import { getOperationalEnv } from "@/lib/env";

const GOOGLE_AUTH_START_PATH = "/api/auth/oauth/google";
const GOOGLE_AUTH_ENTRY_PATH = "/login";

export function isGoogleAuthEnabled() {
  return getOperationalEnv().nextPublicGoogleAuthEnabled;
}

export function buildGoogleAuthStartHref(options?: {
  redirectTo?: string | null | undefined;
}) {
  const searchParams = new URLSearchParams({
    redirectTo: sanitizePrivateRedirectPath(options?.redirectTo),
  });

  return `${GOOGLE_AUTH_START_PATH}?${searchParams.toString()}`;
}

export function getGoogleAuthEntryPath() {
  return GOOGLE_AUTH_ENTRY_PATH;
}

export function getGoogleAuthHref(options?: {
  redirectTo?: string | null | undefined;
}) {
  return isGoogleAuthEnabled() ? buildGoogleAuthStartHref(options) : null;
}

export function getAuthFlowErrorMessage(errorCode: string | null | undefined) {
  switch (errorCode) {
    case "google_auth_unavailable":
      return "Google no esta habilitado en este entorno. Usa email y password mientras termina la configuracion.";
    case "google_auth_start_failed":
      return "No fue posible iniciar el acceso con Google. Intenta de nuevo o usa email y password.";
    case "auth_callback_failed":
      return "No fue posible completar la autenticacion. Intenta de nuevo o usa email y password.";
    case "auth_callback_missing_code":
      return "La autenticacion no devolvio un codigo valido. Intenta otra vez desde el flujo de acceso.";
    default:
      return null;
  }
}
