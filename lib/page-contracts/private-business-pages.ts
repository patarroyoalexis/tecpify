import { createElement, type ComponentType, type ReactNode } from "react";

import type { BusinessContext } from "@/lib/auth/server";
import type { BusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import type { Order } from "@/types/orders";
import type { Product } from "@/types/products";

interface BusinessPageParams {
  params: Promise<{ businessSlug: string }>;
}

export interface BusinessWorkspaceShellContractProps {
  businessName: string;
  businessSlug: string;
  operatorEmail: string | null;
  initialOrders: Order[];
  initialOrdersError?: string | null;
  title: string;
  description: string;
  headerActions?: ReactNode;
  children?: ReactNode;
}

export interface DashboardOverviewContractProps {
  businessSlug: string;
  businessName: string;
  businessReadiness: BusinessReadinessSnapshot;
}

type OrdersHeaderActionsProps = Record<string, never>;

interface OrdersWorkspaceProps {
  businessSlug: string;
}

type MetricsOverviewProps = Record<string, never>;

function renderUnauthorizedBusinessAccess() {
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
          "data-testid": "unauthorized-business-access",
        },
        [
          createElement(
            "p",
            {
              key: "eyebrow",
              className:
                "text-sm font-semibold uppercase tracking-[0.24em] text-rose-500",
            },
            "Acceso no autorizado",
          ),
          createElement(
            "h1",
            {
              key: "title",
              className: "mt-3 text-3xl font-semibold text-slate-950",
            },
            "Este negocio no esta disponible para tu sesion",
          ),
          createElement(
            "p",
            {
              key: "description",
              className: "mt-3 text-sm leading-6 text-slate-600",
            },
            "Solo el owner autenticado puede operar este workspace. Si el negocio sigue legacy y no tiene owner real, el acceso privado queda bloqueado.",
          ),
        ],
      ),
    ),
  );
}

interface CommonPageDependencies {
  requireBusinessContext: (
    businessSlug: string,
    redirectTo: string,
  ) => Promise<BusinessContext | null>;
  getOrdersByBusinessIdFromDatabase: (
    businessId: string,
    options?: { businessSlug?: string },
  ) => Promise<Order[]>;
  BusinessWorkspaceShell: ComponentType<BusinessWorkspaceShellContractProps>;
}

interface DashboardPageDependencies extends CommonPageDependencies {
  getBusinessReadinessSnapshot: (
    totalProducts: number,
    activeProducts: number,
  ) => BusinessReadinessSnapshot;
  getAdminProductsByBusinessId: (businessId: string) => Promise<Product[]>;
  DashboardOverview: ComponentType<DashboardOverviewContractProps>;
}

interface OrdersPageDependencies extends CommonPageDependencies {
  OrdersHeaderActions: ComponentType<OrdersHeaderActionsProps>;
  OrdersWorkspace: ComponentType<OrdersWorkspaceProps>;
}

interface MetricsPageDependencies extends CommonPageDependencies {
  MetricsOverview: ComponentType<MetricsOverviewProps>;
}

export function createBusinessDashboardPage(dependencies: DashboardPageDependencies) {
  return async function BusinessDashboardPage({ params }: BusinessPageParams) {
    const { businessSlug } = await params;
    const businessContext = await dependencies.requireBusinessContext(
      businessSlug,
      `/dashboard/${businessSlug}`,
    );

    if (!businessContext) {
      return renderUnauthorizedBusinessAccess();
    }

    const business = {
      slug: businessContext.businessSlug,
      name: businessContext.businessName,
      databaseId: businessContext.businessId,
    };
    let initialOrders: Order[] = [];
    let initialOrdersError: string | null = null;
    let businessReadiness = dependencies.getBusinessReadinessSnapshot(0, 0);

    try {
      initialOrders = await dependencies.getOrdersByBusinessIdFromDatabase(
        business.databaseId,
        { businessSlug: business.slug },
      );
    } catch (error) {
      initialOrdersError =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pedidos reales de este negocio.";
    }

    try {
      const products = await dependencies.getAdminProductsByBusinessId(business.databaseId);
      businessReadiness = dependencies.getBusinessReadinessSnapshot(
        products.length,
        products.filter((product) => product.is_available).length,
      );
    } catch {
      businessReadiness = dependencies.getBusinessReadinessSnapshot(0, 0);
    }

    return createElement(
      dependencies.BusinessWorkspaceShell,
      {
        businessName: business.name,
        businessSlug: business.slug,
        operatorEmail: businessContext.user.email || null,
        initialOrders,
        initialOrdersError,
        title: "Dashboard",
        description: "Resumen rapido del negocio para priorizar el dia.",
      },
      createElement(dependencies.DashboardOverview, {
        businessSlug: business.slug,
        businessName: business.name,
        businessReadiness,
      }),
    );
  };
}

export function createOrdersPage(dependencies: OrdersPageDependencies) {
  return async function OrdersPage({ params }: BusinessPageParams) {
    const { businessSlug } = await params;
    const businessContext = await dependencies.requireBusinessContext(
      businessSlug,
      `/pedidos/${businessSlug}`,
    );

    if (!businessContext) {
      return renderUnauthorizedBusinessAccess();
    }

    const business = {
      slug: businessContext.businessSlug,
      name: businessContext.businessName,
    };
    let initialOrders: Order[] = [];
    let initialOrdersError: string | null = null;

    try {
      initialOrders = await dependencies.getOrdersByBusinessIdFromDatabase(
        businessContext.businessId,
        { businessSlug: business.slug },
      );
    } catch (error) {
      initialOrdersError =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pedidos reales de este negocio.";
    }

    return createElement(
      dependencies.BusinessWorkspaceShell,
      {
        businessName: business.name,
        businessSlug: business.slug,
        operatorEmail: businessContext.user.email || null,
        initialOrders,
        initialOrdersError,
        title: "Pedidos",
        description: "Operacion diaria para revisar, cobrar, preparar y entregar.",
        headerActions: createElement(dependencies.OrdersHeaderActions),
      },
      createElement(dependencies.OrdersWorkspace, { businessSlug: business.slug }),
    );
  };
}

export function createMetricsPage(dependencies: MetricsPageDependencies) {
  return async function MetricsPage({ params }: BusinessPageParams) {
    const { businessSlug } = await params;
    const businessContext = await dependencies.requireBusinessContext(
      businessSlug,
      `/metricas/${businessSlug}`,
    );

    if (!businessContext) {
      return renderUnauthorizedBusinessAccess();
    }

    const business = {
      slug: businessContext.businessSlug,
      name: businessContext.businessName,
    };
    let initialOrders: Order[] = [];
    let initialOrdersError: string | null = null;

    try {
      initialOrders = await dependencies.getOrdersByBusinessIdFromDatabase(
        businessContext.businessId,
        { businessSlug: business.slug },
      );
    } catch (error) {
      initialOrdersError =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pedidos reales de este negocio.";
    }

    return createElement(
      dependencies.BusinessWorkspaceShell,
      {
        businessName: business.name,
        businessSlug: business.slug,
        operatorEmail: businessContext.user.email || null,
        initialOrders,
        initialOrdersError,
        title: "Metricas",
        description: "Rendimiento del negocio en una capa separada de la operacion.",
      },
      createElement(dependencies.MetricsOverview),
    );
  };
}
