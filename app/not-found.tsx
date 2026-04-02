import { BackButton } from "@/components/layout/back-button";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center p-8 bg-white rounded-[32px] border border-slate-200 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">404</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Página no encontrada</h1>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Lo sentimos, la página que buscas no existe o ha sido movida a otra ubicación.
        </p>
        <BackButton fallbackPath="/ajustes" />
      </div>
    </main>
  );
}
