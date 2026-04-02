"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
}

export function BackButton({ 
  fallbackPath = "/ajustes", 
  className = "mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" 
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // Intentar volver atrás en el historial
    if (window.history.length > 1) {
      router.back();
    } else {
      // Si no hay historial, usar el fallback
      router.push(fallbackPath);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={className}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>Volver</span>
    </button>
  );
}
