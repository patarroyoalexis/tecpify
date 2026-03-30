"use client";

import { Package } from "lucide-react";

import { useBusinessWorkspace } from "@/components/dashboard/business-workspace-context";

export function OrdersHeaderActions() {
  const { openProductsManager } = useBusinessWorkspace();

  return (
    <button
      type="button"
      onClick={openProductsManager}
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-workspace-border bg-white px-4 text-sm font-semibold text-workspace-ink shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-px hover:border-sky-300 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2"
    >
      <Package className="h-4 w-4" />
      <span>Productos</span>
    </button>
  );
}
