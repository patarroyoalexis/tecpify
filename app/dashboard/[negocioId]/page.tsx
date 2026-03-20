import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { resolveOperationalBusinessBySlug } from "@/data/businesses";
import { getBusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import { getAdminProductsByBusinessId } from "@/lib/data/products";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import type { Order } from "@/types/orders";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  const resolvedBusiness = await resolveOperationalBusinessBySlug(negocioId).catch(() => null);
  const business = resolvedBusiness?.business ?? null;
  let initialOrders: Order[] = [];
  let initialOrdersError: string | null = null;
  let businessReadiness = getBusinessReadinessSnapshot(0, 0);

  if (business && resolvedBusiness?.hasDatabaseRecord) {
    try {
      initialOrders = await getOrdersByBusinessSlugFromDatabase(negocioId);
    } catch (error) {
      initialOrdersError =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pedidos reales de este negocio.";
    }

    if (business.databaseId) {
      try {
        const products = await getAdminProductsByBusinessId(business.databaseId);
        businessReadiness = getBusinessReadinessSnapshot(
          products.length,
          products.filter((product) => product.is_available).length,
        );
      } catch {
        businessReadiness = getBusinessReadinessSnapshot(0, 0);
      }
    }
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">
              Dashboard no disponible
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Dashboard solo disponible para negocios reales
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Este espacio privado solo se habilita para negocios persistidos en Supabase.
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
      initialOrders={initialOrders}
      initialOrdersError={initialOrdersError}
      title="Dashboard"
      description="Resumen rapido del negocio para priorizar el dia."
    >
      <DashboardOverview
        businessSlug={business.slug}
        businessName={business.name}
        businessReadiness={businessReadiness}
      />
    </BusinessWorkspaceShell>
  );
}
