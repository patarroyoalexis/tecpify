import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { OrdersHeaderActions } from "@/components/dashboard/orders-header-actions";
import { OrdersWorkspace } from "@/components/dashboard/orders-workspace";
import { resolveOperationalBusinessBySlug } from "@/data/businesses";
import { canOperatorAccessBusiness } from "@/lib/auth/business-access";
import { requireOperatorSession } from "@/lib/auth/server";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import type { Order } from "@/types/orders";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  const operator = await requireOperatorSession(`/pedidos/${negocioId}`);
  const resolvedBusiness = await resolveOperationalBusinessBySlug(negocioId).catch(() => null);
  const business = resolvedBusiness?.business ?? null;
  let initialOrders: Order[] = [];
  let initialOrdersError: string | null = null;

  if (business && !canOperatorAccessBusiness(operator, { createdByUserId: business.createdByUserId ?? null })) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">
              Acceso restringido
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Este espacio de pedidos pertenece a otro operador
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              La sesion actual no coincide con el usuario asociado a este negocio.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (business && resolvedBusiness?.hasDatabaseRecord) {
    try {
      initialOrders = await getOrdersByBusinessSlugFromDatabase(negocioId);
    } catch (error) {
      initialOrdersError =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pedidos reales de este negocio.";
    }
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">
              Pedidos no disponibles
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Pedidos solo disponibles para negocios reales
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Este espacio operativo solo funciona con negocios persistidos en Supabase.
              Verifica el enlace del negocio real o crea uno nuevo desde la home.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <BusinessWorkspaceShell
      businessId={business.databaseId ?? business.slug}
      businessDatabaseId={business.databaseId ?? null}
      businessName={business.name}
      businessSlug={business.slug}
      operatorEmail={operator.email}
      initialOrders={initialOrders}
      initialOrdersError={initialOrdersError}
      title="Pedidos"
      description="Operacion diaria para revisar, cobrar, preparar y entregar."
      headerActions={<OrdersHeaderActions />}
    >
      <OrdersWorkspace
        businessId={business.databaseId ?? business.slug}
      />
    </BusinessWorkspaceShell>
  );
}
