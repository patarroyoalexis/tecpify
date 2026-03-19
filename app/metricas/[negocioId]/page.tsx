import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { MetricsOverview } from "@/components/dashboard/metrics-overview";
import { getBusinessBySlug, getBusinessBySlugFromDatabase } from "@/data/businesses";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import type { Order } from "@/types/orders";

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  const business = getBusinessBySlug(negocioId);
  const databaseBusiness = business
    ? await getBusinessBySlugFromDatabase(negocioId).catch(() => null)
    : null;
  let initialOrders: Order[] = [];
  let initialOrdersError: string | null = null;

  if (business && databaseBusiness) {
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
              Metricas no disponibles
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Negocio no encontrado
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Este panel no corresponde a una tienda activa en la demo. Verifica el
              enlace privado del negocio.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <BusinessWorkspaceShell
      businessId={business.slug}
      businessDatabaseId={databaseBusiness?.id ?? null}
      businessName={business.name}
      businessSlug={business.slug}
      initialOrders={initialOrders}
      initialOrdersError={initialOrdersError}
      title="Metricas"
      description="Rendimiento del negocio en una capa separada de la operacion."
    >
      <MetricsOverview />
    </BusinessWorkspaceShell>
  );
}
