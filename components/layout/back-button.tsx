"use client";

import { createElement } from "react";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
}

const DEFAULT_BACK_BUTTON_CLASS_NAME =
  "mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800";

export function BackButton({
  fallbackPath = "/ajustes",
  className = DEFAULT_BACK_BUTTON_CLASS_NAME,
}: BackButtonProps) {
  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign(fallbackPath);
  }

  return createElement(
    "button",
    {
      onClick: handleBack,
      className,
    },
    createElement(ChevronLeft, { className: "h-4 w-4" }),
    createElement("span", null, "Volver"),
  );
}
