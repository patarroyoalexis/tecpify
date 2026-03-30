export type AdminKpiFormatter = "count" | "currency";

export interface AdminDashboardKpi {
  key:
    | "total_businesses"
    | "active_businesses_last_7_days"
    | "businesses_with_published_catalog"
    | "businesses_with_orders"
    | "total_platform_orders"
    | "platform_gmv_total";
  label: string;
  value: number;
  formatter: AdminKpiFormatter;
  description: string;
}

export interface AdminDashboardSeriesPoint {
  key: string;
  label: string;
  value: number;
}

export interface AdminDashboardChartSection {
  title: string;
  description: string;
  points: AdminDashboardSeriesPoint[];
}

export interface AdminActivationFunnelStep {
  key:
    | "account_created"
    | "business_created"
    | "first_product_loaded"
    | "published_catalog"
    | "first_order_received";
  label: string;
  value: number;
  measurement: string;
}

export type AdminBusinessActivationStageKey =
  | "business_created"
  | "first_product_loaded"
  | "published_catalog"
  | "first_order_received";

export interface AdminBusinessActivationStage {
  key: AdminBusinessActivationStageKey;
  label: string;
  description: string;
  completedSteps: number;
  totalSteps: number;
}

export interface AdminBusinessOperationalRow {
  businessId: string;
  businessSlug: string;
  businessName: string;
  createdByUserId: string | null;
  createdAt: string;
  lastActivityAt: string;
  productsCount: number;
  activeProductsCount: number;
  ordersCount: number;
  effectiveGmv: number;
  activationStage: AdminBusinessActivationStage;
}

export interface AdminDashboardMeasurementNote {
  key: string;
  title: string;
  description: string;
}

export interface AdminDashboardSnapshot {
  generatedAt: string;
  kpis: AdminDashboardKpi[];
  charts: {
    recentBusinesses: AdminDashboardChartSection;
    ordersByDay: AdminDashboardChartSection;
    gmvByDay: AdminDashboardChartSection;
  };
  funnel: AdminActivationFunnelStep[];
  tables: {
    recentBusinesses: AdminBusinessOperationalRow[];
    businessesWithoutProducts: AdminBusinessOperationalRow[];
    businessesWithoutOrders: AdminBusinessOperationalRow[];
    recentActivityBusinesses: AdminBusinessOperationalRow[];
    incompleteActivationBusinesses: AdminBusinessOperationalRow[];
  };
  notes: AdminDashboardMeasurementNote[];
}
