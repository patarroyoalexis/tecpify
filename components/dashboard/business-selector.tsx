import Link from "next/link";
import { Plus } from "lucide-react";

import { CREATE_BUSINESS_ROUTE, getBusinessDashboardHref } from "@/lib/auth/private-workspace";
import type { OwnedBusinessSummary } from "@/types/businesses";

interface BusinessSelectorProps {
  businesses: OwnedBusinessSummary[];
}

export function BusinessSelector({ businesses }: BusinessSelectorProps) {
  const activeBusinesses = businesses.filter((business) => business.isActive);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {activeBusinesses.map((business) => (
        <BusinessSelectorCard key={business.businessId} business={business} />
      ))}
      <CreateBusinessCard />
    </div>
  );
}

function BusinessSelectorCard({ business }: { business: OwnedBusinessSummary }) {
  const href = getBusinessDashboardHref(business.businessSlug);

  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-[32px] border border-slate-200 bg-white p-8 transition-all hover:border-slate-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-slate-100">
            <span className="text-xl font-bold">{business.businessName.charAt(0).toUpperCase()}</span>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {business.businessSlug}
          </span>
        </div>

        <h3 className="text-xl font-bold text-slate-950 transition-colors group-hover:text-slate-900">
          {business.businessName}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
          Entra al espacio de trabajo para revisar pedidos, productos y ventas.
        </p>

        <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-950">
          <span>Abrir espacio de trabajo</span>
          <span className="transition-transform group-hover:translate-x-1">-&gt;</span>
        </div>
      </div>
    </Link>
  );
}

function CreateBusinessCard() {
  return (
    <Link
      href={CREATE_BUSINESS_ROUTE}
      className="group relative flex flex-col rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 transition-all hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex min-h-[160px] h-full flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
          <Plus className="h-6 w-6 text-slate-950" />
        </div>
        <h3 className="text-lg font-bold text-slate-950">Crear otro negocio</h3>
        <p className="mt-1 text-sm text-slate-500">
          Agrega otra marca para administrarla desde la misma cuenta.
        </p>
      </div>
    </Link>
  );
}
