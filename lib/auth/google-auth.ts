import { sanitizeRedirectPath } from "@/lib/auth/redirect-path";
import { getOperationalEnv } from "@/lib/env";

export type AuthEntryIntent = "login" | "register";

const GOOGLE_AUTH_START_PATH = "/api/auth/oauth/google";

export function isGoogleAuthEnabled() {
  return getOperationalEnv().nextPublicGoogleAuthEnabled;
}

export function parseAuthEntryIntent(intent: string | null | undefined): AuthEntryIntent {
  return intent === "register" ? "register" : "login";
}

export function getAuthEntryPath(intent: AuthEntryIntent) {
  return intent === "register" ? "/register" : "/login";
}

export function buildGoogleAuthStartHref(options?: {
  redirectTo?: string | null | undefined;
  intent?: AuthEntryIntent;
}) {
  const searchParams = new URLSearchParams({
    redirectTo: sanitizeRedirectPath(options?.redirectTo),
    intent: options?.intent ?? "login",
  });

  return `${GOOGLE_AUTH_START_PATH}?${searchParams.toString()}`;
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
