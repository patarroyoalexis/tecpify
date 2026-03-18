import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { OrdersHeaderActions } from "@/components/dashboard/orders-header-actions";
import { OrdersWorkspace } from "@/components/dashboard/orders-workspace";
import { getBusinessBySlug, getBusinessBySlugFromDatabase } from "@/data/businesses";
import { getOrdersByBusinessSlugFromDatabase } from "@/lib/data/orders-server";
import { getMockOrdersByBusinessId } from "@/data/orders";

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ negocioId: string }>;
}) {
  const { negocioId } = await params;
  const business = getBusinessBySlug(negocioId);
  const databaseBusiness = business
    ? await getBusinessBySlugFromDatabase(negocioId)
    : null;
  const initialOrders = business
    ? await getOrdersByBusinessSlugFromDatabase(negocioId).catch(() =>
        getMockOrdersByBusinessId(business.slug),
      )
    : [];

  if (!business) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">
              Pedidos no disponibles
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
      initialOrders={databaseBusiness ? initialOrders : getMockOrdersByBusinessId(business.slug)}
      title="Pedidos"
      description="Operacion diaria para revisar, cobrar, preparar y entregar."
      headerActions={<OrdersHeaderActions />}
    >
      <OrdersWorkspace
        businessId={business.slug}
      />
    </BusinessWorkspaceShell>
  );
}
