import Link from "next/link";
import { Plus } from "lucide-react";
import type { OwnedBusinessSummary } from "@/types/businesses";
import { getBusinessDashboardHref, CREATE_BUSINESS_ROUTE } from "@/lib/auth/private-workspace";

interface BusinessSelectorProps {
  businesses: OwnedBusinessSummary[];
}

export function BusinessSelector({ businesses }: BusinessSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {businesses.map((business) => (
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
      <div className="flex flex-col h-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 transition-colors">
            <span className="text-xl font-bold">{business.businessName.charAt(0).toUpperCase()}</span>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {business.businessSlug}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-slate-950 group-hover:text-slate-900 transition-colors">
          {business.businessName}
        </h3>
        
        <p className="mt-2 text-sm text-slate-500 line-clamp-2">
          Entrar al espacio de trabajo para gestionar pedidos y catálogo.
        </p>

        <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-950">
          <span>Abrir workspace</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
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
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
          <Plus className="h-6 w-6 text-slate-950" />
        </div>
        <h3 className="text-lg font-bold text-slate-950">
          Crear otro negocio
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Agrega una nueva marca a tu cuenta.
        </p>
      </div>
    </Link>
  );
}
