import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const operator = await getCurrentUser();

  // Si no está autenticado, redirigir al login
  if (!operator) {
    redirect("/login?redirectTo=/onboarding");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Header minimo con Logo y Volver */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between bg-white/80 px-6 backdrop-blur-sm sm:h-20 sm:px-10">
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
          <Image
            src="/images/landing/Tecpify-logo.png"
            alt="Tecpify Logo"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900">Tecpify</span>
        </Link>
        
        <Link 
          href="/login" 
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Volver al login</span>
        </Link>
      </header>

      <main className="pt-20 sm:pt-28">
        <OnboardingFlow />
      </main>
    </div>
  );
}
