import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import {
  getAuthFlowErrorMessage,
  getGoogleAuthHref,
} from "@/lib/auth/google-auth";
import { getCurrentUser, sanitizePrivateRedirectPath } from "@/lib/auth/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizePrivateRedirectPath(resolvedSearchParams.redirectTo);
  const authErrorMessage = getAuthFlowErrorMessage(resolvedSearchParams.error);
  const googleAuthHref = getGoogleAuthHref({ redirectTo });
  const operator = await getCurrentUser();

  if (operator) {
    redirect(redirectTo);
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
          initialError={authErrorMessage}
          googleAuthHref={googleAuthHref}
        />
      </AuthPageShell>
    </PublicLayoutShell>
  );
}
