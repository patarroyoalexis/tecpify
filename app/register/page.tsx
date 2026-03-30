import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import { getAuthFlowErrorMessage } from "@/lib/auth/google-auth";
import { getCurrentUser, sanitizePrivateRedirectPath } from "@/lib/auth/server";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizePrivateRedirectPath(resolvedSearchParams.redirectTo);
  const authErrorMessage = getAuthFlowErrorMessage(resolvedSearchParams.error);
  const operator = await getCurrentUser();

  if (operator) {
    redirect(redirectTo);
  }

  return (
    <PublicLayoutShell>
      <AuthPageShell
        variant="register"
        formEyebrow="Carril secundario"
        formTitle="Registro manual"
        formDescription={
          <>
            Este flujo no forma parte del circuito garantizado del MVP. Puede
            requerir confirmacion de correo y configuracion real de Supabase Auth
            antes de que el login quede operativo. Si este entorno habilita
            Google, ese carril opcional se intenta solo desde /login.
          </>
        }
      >
        <RegisterForm
          redirectTo={redirectTo}
          initialError={authErrorMessage}
        />
      </AuthPageShell>
    </PublicLayoutShell>
  );
}
