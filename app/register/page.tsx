import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { PublicLayoutShell } from "@/components/layout/public-layout-shell";
import { getOperatorSession, sanitizeRedirectPath } from "@/lib/auth/server";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizeRedirectPath(resolvedSearchParams.redirectTo);
  const operator = await getOperatorSession();

  if (operator) {
    redirect(redirectTo);
  }

  return (
    <PublicLayoutShell>
      <main className="bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eefbf7_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-5xl items-center">
          <section className="grid w-full gap-6 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(6,78,59,0.98),rgba(21,128,61,0.96))] p-6 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-100">
                Registro operativo
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Crea tu acceso privado de Tecpify
              </h1>
              <p className="mt-4 text-sm leading-6 text-emerald-50">
                Esta cuenta te permite crear negocios con ownership inicial y entrar al espacio
                operativo protegido sin abrir todavia roles ni multiusuario avanzado.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-emerald-50">
                El storefront publico sigue abierto para clientes. Lo que cerramos aqui es el
                acceso operativo de dashboard, pedidos, metricas y gestion interna.
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Cuenta basica
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Registrate para operar
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Despues del registro volveras a{" "}
                <span className="font-medium text-slate-900">{redirectTo}</span>.
              </p>

              <RegisterForm redirectTo={redirectTo} />
            </div>
          </section>
        </div>
      </main>
    </PublicLayoutShell>
  );
}
