import { CreateBusinessPanel } from "@/components/home/create-business-panel";
import { BusinessCard } from "@/components/home/business-card";
import type { HomeBusinessesSnapshot } from "@/data/businesses";

interface OperationalHomeProps {
  businesses: HomeBusinessesSnapshot;
  operatorEmail: string | null;
}

export function OperationalHome({
  businesses,
  operatorEmail,
}: OperationalHomeProps) {
  const { realBusinesses, demoBusinesses } = businesses;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Centro operativo
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Administra tus negocios y valida el flujo real del MVP
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Desde aqui puedes crear nuevos negocios, abrir dashboards existentes y revisar los
            escenarios demo sin mezclar la landing publica con la operacion autenticada.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              {realBusinesses.length} negocio{realBusinesses.length === 1 ? "" : "s"} real
              {realBusinesses.length === 1 ? "" : "es"}
            </span>
            {operatorEmail ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
                Sesion activa: {operatorEmail}
              </span>
            ) : null}
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
              {demoBusinesses.length} demo{demoBusinesses.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <CreateBusinessPanel />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Negocios reales</h3>
            <p className="mt-1 text-sm text-slate-600">
              Los negocios visibles respetan la politica actual de ownership del operador.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {realBusinesses.length}
          </span>
        </div>

        {realBusinesses.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {realBusinesses.map((business) => (
              <BusinessCard
                key={business.slug}
                business={business}
                badge="Real"
                actions={[
                  {
                    href: `/dashboard/${business.slug}`,
                    label: "Abrir dashboard",
                  },
                  {
                    href: `/pedidos/${business.slug}`,
                    label: "Ir a pedidos",
                    variant: "secondary",
                  },
                  {
                    href: `/metricas/${business.slug}`,
                    label: "Ver metricas",
                    variant: "secondary",
                  },
                  {
                    href: `/pedido/${business.slug}`,
                    label: "Abrir formulario publico",
                    variant: "secondary",
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
            Aun no hay negocios reales visibles para esta sesion. Crea el primero para empezar el
            flujo operativo.
          </div>
        )}
      </section>

      {demoBusinesses.length > 0 ? (
        <section className="space-y-4 rounded-[28px] border border-amber-200/80 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                Soporte demo
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                Escenarios de muestra
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Siguen disponibles para pruebas locales y showcase, pero ya no ocupan la ruta
                principal del producto.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              {demoBusinesses.length}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {demoBusinesses.map((business) => (
              <BusinessCard
                key={business.slug}
                business={business}
                badge="Demo"
                tone="demo"
                actions={[
                  {
                    href: `/pedido/${business.slug}`,
                    label: "Ver storefront demo",
                  },
                ]}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
