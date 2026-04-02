import { redirect } from "next/navigation";
import Link from "next/link";

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
      <Link
        href="/login"
        className="absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-900 hover:shadow-md sm:left-6 sm:top-6 sm:px-3.5 sm:py-2 sm:text-xs lg:left-8 lg:top-8"
      >
        Volver al login
      </Link>
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:h-screen lg:overflow-hidden lg:px-8 lg:pt-6 lg:pb-4">
        <OnboardingFlow />
      </main>
    </div>
  );
}
