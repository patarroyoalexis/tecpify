import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import {
  buildGoogleAuthStartHref,
  getAuthFlowErrorMessage,
  isGoogleAuthEnabled,
} from "@/lib/auth/google-auth";
import { getCurrentUser, sanitizeRedirectPath } from "@/lib/auth/server";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizeRedirectPath(resolvedSearchParams.redirectTo);
  const authErrorMessage = getAuthFlowErrorMessage(resolvedSearchParams.error);
  const googleAuthHref = isGoogleAuthEnabled()
    ? buildGoogleAuthStartHref({
        redirectTo,
        intent: "register",
      })
    : null;
  const operator = await getCurrentUser();

  if (operator) {
    redirect(redirectTo);
  }

  return (
    <PublicLayoutShell>
      <AuthPageShell
        variant="register"
        formEyebrow="Comienza aquí"
        formTitle="Crear cuenta"
        formDescription={
          <>
            Registrate para crear y gestionar tu negocio desde un sólo lugar.
          </>
        }
        redirectTo={redirectTo}
      >
        <RegisterForm
          redirectTo={redirectTo}
          initialError={authErrorMessage}
          googleAuthHref={googleAuthHref}
        />
      </AuthPageShell>
    </PublicLayoutShell>
  );
}
