import { LandingPage } from "@/components/home/landing-page";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import { getOperatorSession } from "@/lib/auth/server";

export default async function Home() {
  const operator = await getOperatorSession();

  return (
    <PublicLayoutShell operatorEmail={operator?.email ?? null}>
      <LandingPage isAuthenticated={Boolean(operator)} />
    </PublicLayoutShell>
  );
}
