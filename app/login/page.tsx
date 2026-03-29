import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import {
  getAuthFlowErrorMessage,
  getGoogleAuthHref,
} from "@/lib/auth/google-auth";
import { getCurrentUser, sanitizeRedirectPath } from "@/lib/auth/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizeRedirectPath(resolvedSearchParams.redirectTo);
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
        formEyebrow="Ingreso rápido"
        formTitle="Iniciar sesión"
        formDescription={
          <>
            Accede con un usuario ya operativo para gestionar pedidos, actualizar estados y llevar el control del negocio. Este es el carril validado del MVP para entrar al workspace.
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
