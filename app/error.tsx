"use client";

import { useEffect } from "react";
import { BackButton } from "@/components/layout/back-button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Opcional: Log del error a un servicio de monitoreo
    console.error("Runtime error caught by boundary:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center p-8 bg-white rounded-[32px] border border-slate-200 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-600">Error</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Algo salió mal</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Ha ocurrido un error inesperado en la aplicación. Nuestro equipo ha sido notificado.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Intentar de nuevo
          </button>
          <BackButton fallbackPath="/ajustes" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" />
        </div>
      </div>
    </main>
  );
}
