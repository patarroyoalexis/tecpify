import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const operator = await getCurrentUser();

  // Si no está autenticado, redirigir al login
  if (!operator) {
    redirect("/login?redirectTo=/onboarding");
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:h-screen lg:overflow-hidden lg:px-8 lg:pt-6 lg:pb-4">
        <OnboardingFlow />
      </main>
    </div>
  );
}
