import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import {
  getAuthFlowErrorMessage,
  getGoogleAuthHref,
} from "@/lib/auth/google-auth";
import { resolvePrivateWorkspaceEntryFromCookies } from "@/lib/auth/private-workspace";
import { getCurrentUser } from "@/lib/auth/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const hasExplicitRedirectTo = resolvedSearchParams.redirectTo !== undefined;
  const redirectTo = hasExplicitRedirectTo
    ? sanitizeRedirectPath(resolvedSearchParams.redirectTo, "") || null
    : null;
  const authErrorMessage = getAuthFlowErrorMessage(resolvedSearchParams.error);
  const googleAuthHref = getGoogleAuthHref({
    hasExplicitRedirectTo: hasExplicitRedirectTo && Boolean(redirectTo),
    redirectTo,
  });
  const operator = await getCurrentUser();

  if (operator) {
    const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);
    redirect(workspaceEntry.entryHref);
  }

  return (
    <PublicLayoutShell>
      <AuthPageShell
        variant="login"
        formEyebrow="Acceso al negocio"
        formTitle="Entra a tu espacio de trabajo"
        formDescription={
          <>
            Usa una cuenta ya activa para revisar pedidos, mover estados y seguir el día a día del
            negocio desde un solo lugar.
          </>
        }
      >
        <LoginForm
          redirectTo={redirectTo}
          hasExplicitRedirectTo={hasExplicitRedirectTo && Boolean(redirectTo)}
          initialError={authErrorMessage}
          googleAuthHref={googleAuthHref}
        />
      </AuthPageShell>
    </PublicLayoutShell>
  );
}
