import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import { getAuthFlowErrorMessage } from "@/lib/auth/google-auth";
import { resolvePrivateWorkspaceEntryFromCookies } from "@/lib/auth/private-workspace";
import { getCurrentUser } from "@/lib/auth/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect-path";

export default async function RegisterPage({
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
  const operator = await getCurrentUser();

  if (operator) {
    const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);
    redirect(workspaceEntry.entryHref);
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
          hasExplicitRedirectTo={hasExplicitRedirectTo && Boolean(redirectTo)}
          initialError={authErrorMessage}
        />
      </AuthPageShell>
    </PublicLayoutShell>
  );
}
