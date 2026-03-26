import { createElement, Fragment, type ComponentType, type ReactNode } from "react";

import type { BusinessProductsLookupResult } from "@/data/businesses";
import type { BusinessConfig } from "@/types/storefront";

interface StorefrontOrderPageParams {
  params: Promise<{ negocioId: string }>;
}

function StorefrontMessage({
  tone,
  eyebrow,
  title,
  description,
}: {
  tone: "rose" | "amber";
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return createElement(
    "main",
    {
      className:
        "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-8 sm:px-6",
    },
    createElement(
      "div",
      {
        className: "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center",
      },
      createElement(
        "section",
        {
          className:
            "w-full rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]",
        },
        [
          createElement(
            "p",
            {
              key: "eyebrow",
              className: `text-sm font-semibold uppercase tracking-[0.24em] ${
                tone === "rose" ? "text-rose-500" : "text-amber-600"
              }`,
            },
            eyebrow,
          ),
          createElement(
            "p",
            {
              key: "title",
              className: "mt-3 text-3xl font-semibold text-slate-950",
            },
            title,
          ),
          createElement(
            "div",
            {
              key: "description",
              className: "mt-3 text-sm leading-6 text-slate-600",
            },
            description,
          ),
        ],
      ),
    ),
  );
}

interface StorefrontOrderPageDependencies {
  getBusinessBySlugWithProducts: (
    slug: string,
  ) => Promise<BusinessProductsLookupResult>;
  StorefrontOrderWizard: ComponentType<{ business: BusinessConfig }>;
}

export function createStorefrontOrderPage(
  dependencies: StorefrontOrderPageDependencies,
) {
  return async function StorefrontOrderPage({ params }: StorefrontOrderPageParams) {
    const { negocioId } = await params;
    let business = null;

    try {
      const result = await dependencies.getBusinessBySlugWithProducts(negocioId);

      if (result.status === "ok" || result.status === "no_products") {
        business = result.business;
      }
    } catch {
      business = null;
    }

    if (!business) {
      return createElement(StorefrontMessage, {
        tone: "rose",
        eyebrow: "Link no disponible",
        title: "Negocio no encontrado",
        description: createElement(
          Fragment,
          null,
          "Este enlace no corresponde a un negocio real disponible. Verifica el link o solicita uno nuevo.",
        ),
      });
    }

    if (business.products.length === 0) {
      return createElement(StorefrontMessage, {
        tone: "amber",
        eyebrow: "Catalogo no disponible",
        title: "Este negocio aun no esta listo para recibir pedidos",
        description: createElement(
          Fragment,
          null,
          `${business.name} ya existe, pero todavia no tiene productos activos para recibir pedidos desde este formulario.`,
        ),
      });
    }

    return createElement(dependencies.StorefrontOrderWizard, { business });
  };
}
