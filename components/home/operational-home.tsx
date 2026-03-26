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
  const { realBusinesses, unsupportedLegacyBusinessesCount } = businesses;

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
            Desde aqui puedes crear nuevos negocios y abrir workspaces reales sin mezclar
            la operacion autenticada con escenarios de showcase.
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
            {unsupportedLegacyBusinessesCount > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                {unsupportedLegacyBusinessesCount} legacy ownerless no soportado
                {unsupportedLegacyBusinessesCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

        <CreateBusinessPanel />
      </section>

      {unsupportedLegacyBusinessesCount > 0 ? (
        <section className="rounded-[32px] border border-amber-200 bg-amber-50/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
            Legacy ownerless
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            No soportados en runtime del MVP
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Se detectaron {unsupportedLegacyBusinessesCount} negocio
            {unsupportedLegacyBusinessesCount === 1 ? "" : "s"} legacy sin owner real.
            Permanecen bloqueados fuera del workspace, del storefront publico y de los pedidos
            operativos. Tecpify ya no ofrece remediacion ni claim dentro del producto para estos
            casos.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Si alguno debe volver a existir, el saneamiento tiene que ocurrir fuera del runtime del
            MVP antes de reingresar como negocio valido con owner persistido.
          </p>
        </section>
      ) : null}

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

    </div>
  );
}
