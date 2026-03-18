"use client";

import { Package } from "lucide-react";

import { useBusinessWorkspace } from "@/components/dashboard/business-workspace-context";

export function OrdersHeaderActions() {
  const { openProductsManager } = useBusinessWorkspace();

  return (
    <button
      type="button"
      onClick={openProductsManager}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
    >
      <Package className="h-4 w-4" />
      <span>Productos</span>
    </button>
  );
}
