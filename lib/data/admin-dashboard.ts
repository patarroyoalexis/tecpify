import { isAppRole, isPlatformAdminRole, type AppRole } from "@/lib/auth/roles";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import type {
  AdminActivationFunnelStep,
  AdminBusinessActivationStage,
  AdminBusinessOperationalRow,
  AdminDashboardChartSection,
  AdminDashboardKpi,
  AdminDashboardMeasurementNote,
  AdminDashboardSeriesPoint,
  AdminDashboardSnapshot,
} from "@/types/admin-dashboard";
import type { FiadoStatus, OrderStatus } from "@/types/orders";

const RECENT_ACTIVITY_WINDOW_DAYS = 7;
const RECENT_SERIES_DAYS = 14;
const BUSINESS_ACTIVATION_TOTAL_STEPS = 4;

interface AdminDashboardViewer {
  userId: string;
  role: AppRole;
}

export interface AdminDashboardUserProfileRow {
  userId: string;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardBusinessRow {
  businessId: string;
  businessSlug: string;
  businessName: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardProductRow {
  productId: string;
  businessId: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardOrderRow {
  orderId: string;
  businessId: string;
  total: number;
  status: OrderStatus;
  isFiado: boolean;
  fiadoStatus: FiadoStatus | null;
  createdAt: string;
  updatedAt: string;
}

interface UserProfileRow {
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductRow {
  id: string;
  business_id: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface OrderRow {
  id: string;
  business_id: string;
  total: number;
  status: OrderStatus;
  is_fiado: boolean;
  fiado_status: FiadoStatus | null;
  created_at: string;
  updated_at: string;
}

function assertPlatformAdminAccess(viewer: AdminDashboardViewer) {
  if (!isPlatformAdminRole(viewer.role)) {
    throw new Error(
      `El usuario ${viewer.userId} no puede consultar metricas globales sin rol platform_admin.`,
    );
  }
}

function toUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatSeriesLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function getSeriesWindow(now: Date, days: number) {
  const end = toUtcDayStart(now);
  const start = addUtcDays(end, -(days - 1));
  return { start, end };
}

function toDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildEmptyRecentSeries(now: Date, days: number): AdminDashboardSeriesPoint[] {
  const { start } = getSeriesWindow(now, days);

  return Array.from({ length: days }, (_, index) => {
    const date = addUtcDays(start, index);
    const key = toDayKey(date.toISOString());

    return {
      key,
      label: formatSeriesLabel(date),
      value: 0,
    };
  });
}

function buildRecentSeries(
  values: string[],
  now: Date,
  days: number,
  increment: number | ((value: string) => number) = 1,
): AdminDashboardSeriesPoint[] {
  const points = buildEmptyRecentSeries(now, days);
  const pointsByKey = new Map(points.map((point) => [point.key, point]));
  const { start } = getSeriesWindow(now, days);
  const windowStart = start.getTime();

  for (const value of values) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || date.getTime() < windowStart) {
      continue;
    }

    const point = pointsByKey.get(toDayKey(value));

    if (!point) {
      continue;
    }

    point.value += typeof increment === "function" ? increment(value) : increment;
  }

  return points;
}

function buildRecentWeightedSeries<TValue extends { createdAt: string }>(
  values: TValue[],
  now: Date,
  days: number,
  getAmount: (value: TValue) => number,
): AdminDashboardSeriesPoint[] {
  const points = buildEmptyRecentSeries(now, days);
  const pointsByKey = new Map(points.map((point) => [point.key, point]));
  const { start } = getSeriesWindow(now, days);
  const windowStart = start.getTime();

  for (const value of values) {
    const date = new Date(value.createdAt);

    if (Number.isNaN(date.getTime()) || date.getTime() < windowStart) {
      continue;
    }

    const point = pointsByKey.get(toDayKey(value.createdAt));

    if (!point) {
      continue;
    }

    point.value += getAmount(value);
  }

  return points;
}

function isPendingFiadoOrder(order: Pick<AdminDashboardOrderRow, "isFiado" | "fiadoStatus">) {
  return order.isFiado && order.fiadoStatus === "pending";
}

function isEffectiveGmvOrder(
  order: Pick<AdminDashboardOrderRow, "status" | "isFiado" | "fiadoStatus">,
) {
  return order.status !== "cancelado" && !isPendingFiadoOrder(order);
}

function createActivationStage(
  key: AdminBusinessActivationStage["key"],
): AdminBusinessActivationStage {
  switch (key) {
    case "business_created":
      return {
        key,
        label: "Negocio creado",
        description: "El negocio existe, pero todavia no carga productos reales.",
        completedSteps: 1,
        totalSteps: BUSINESS_ACTIVATION_TOTAL_STEPS,
      };
    case "first_product_loaded":
      return {
        key,
        label: "Primer producto cargado",
        description: "Ya hay productos persistidos, pero ningun catalogo activo publicado.",
        completedSteps: 2,
        totalSteps: BUSINESS_ACTIVATION_TOTAL_STEPS,
      };
    case "published_catalog":
      return {
        key,
        label: "Catalogo activo",
        description: "El catalogo ya tiene al menos un producto activo, pero aun no llega el primer pedido.",
        completedSteps: 3,
        totalSteps: BUSINESS_ACTIVATION_TOTAL_STEPS,
      };
    case "first_order_received":
      return {
        key,
        label: "Primer pedido recibido",
        description: "El negocio ya completo la activacion minima basada en pedidos persistidos.",
        completedSteps: 4,
        totalSteps: BUSINESS_ACTIVATION_TOTAL_STEPS,
      };
    default: {
      const exhaustiveCheck: never = key;
      return exhaustiveCheck;
    }
  }
}

function getMaxTimestamp(values: string[]) {
  const validTimestamps = values
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (validTimestamps.length === 0) {
    return new Date(0).toISOString();
  }

  return new Date(Math.max(...validTimestamps)).toISOString();
}

function sortRowsByDateDesc(
  rows: AdminBusinessOperationalRow[],
  getDate: (row: AdminBusinessOperationalRow) => string,
) {
  return [...rows].sort(
    (left, right) => new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime(),
  );
}

function mapUserProfiles(rows: UserProfileRow[]): AdminDashboardUserProfileRow[] {
  return rows.map((row) => {
    if (!isAppRole(row.role)) {
      throw new Error(`user_profiles.role contiene un valor invalido: "${row.role}".`);
    }

    return {
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

function mapBusinesses(rows: BusinessRow[]): AdminDashboardBusinessRow[] {
  return rows.map((row) => ({
    businessId: row.id,
    businessSlug: row.slug,
    businessName: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapProducts(rows: ProductRow[]): AdminDashboardProductRow[] {
  return rows.map((row) => ({
    productId: row.id,
    businessId: row.business_id,
    isAvailable: row.is_available,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapOrders(rows: OrderRow[]): AdminDashboardOrderRow[] {
  return rows.map((row) => ({
    orderId: row.id,
    businessId: row.business_id,
    total: row.total,
    status: row.status,
    isFiado: row.is_fiado,
    fiadoStatus: row.fiado_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function buildAdminDashboardSnapshot(
  input: {
    profiles: AdminDashboardUserProfileRow[];
    businesses: AdminDashboardBusinessRow[];
    products: AdminDashboardProductRow[];
    orders: AdminDashboardOrderRow[];
  },
  now = new Date(),
): AdminDashboardSnapshot {
  const productsByBusinessId = new Map<string, AdminDashboardProductRow[]>();
  const ordersByBusinessId = new Map<string, AdminDashboardOrderRow[]>();
  const recentActivityCutoff = addUtcDays(toUtcDayStart(now), -(RECENT_ACTIVITY_WINDOW_DAYS - 1))
    .getTime();

  for (const product of input.products) {
    const currentProducts = productsByBusinessId.get(product.businessId) ?? [];
    currentProducts.push(product);
    productsByBusinessId.set(product.businessId, currentProducts);
  }

  for (const order of input.orders) {
    const currentOrders = ordersByBusinessId.get(order.businessId) ?? [];
    currentOrders.push(order);
    ordersByBusinessId.set(order.businessId, currentOrders);
  }

  const businessRows: AdminBusinessOperationalRow[] = input.businesses.map((business) => {
    const businessProducts = productsByBusinessId.get(business.businessId) ?? [];
    const businessOrders = ordersByBusinessId.get(business.businessId) ?? [];
    const activeProductsCount = businessProducts.filter((product) => product.isAvailable).length;
    const ordersCount = businessOrders.length;
    const effectiveGmv = businessOrders
      .filter(isEffectiveGmvOrder)
      .reduce((sum, order) => sum + order.total, 0);
    const activationStage =
      ordersCount > 0
        ? createActivationStage("first_order_received")
        : activeProductsCount > 0
          ? createActivationStage("published_catalog")
          : businessProducts.length > 0
            ? createActivationStage("first_product_loaded")
            : createActivationStage("business_created");
    const lastActivityAt = getMaxTimestamp([
      business.updatedAt,
      ...businessProducts.flatMap((product) => [product.createdAt, product.updatedAt]),
      ...businessOrders.flatMap((order) => [order.createdAt, order.updatedAt]),
    ]);

    return {
      businessId: business.businessId,
      businessSlug: business.businessSlug,
      businessName: business.businessName,
      createdByUserId: business.createdByUserId,
      createdAt: business.createdAt,
      lastActivityAt,
      productsCount: businessProducts.length,
      activeProductsCount,
      ordersCount,
      effectiveGmv,
      activationStage,
    };
  });

  const businessOwnerUserIds = new Set(
    input.businesses
      .map((business) => business.createdByUserId)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
  );
  const activationCandidateUserIds = new Set<string>();

  for (const profile of input.profiles) {
    if (profile.role === "business_owner" || businessOwnerUserIds.has(profile.userId)) {
      activationCandidateUserIds.add(profile.userId);
    }
  }

  const userIdsWithProducts = new Set<string>();
  const userIdsWithPublishedCatalog = new Set<string>();
  const userIdsWithOrders = new Set<string>();

  for (const row of businessRows) {
    if (!row.createdByUserId) {
      continue;
    }

    if (row.productsCount > 0) {
      userIdsWithProducts.add(row.createdByUserId);
    }

    if (row.activeProductsCount > 0) {
      userIdsWithPublishedCatalog.add(row.createdByUserId);
    }

    if (row.ordersCount > 0) {
      userIdsWithOrders.add(row.createdByUserId);
    }
  }

  const totalPlatformGmv = input.orders
    .filter(isEffectiveGmvOrder)
    .reduce((sum, order) => sum + order.total, 0);
  const activeBusinessesLast7Days = businessRows.filter(
    (row) => new Date(row.lastActivityAt).getTime() >= recentActivityCutoff,
  );

  const kpis: AdminDashboardKpi[] = [
    {
      key: "total_businesses",
      label: "Negocios registrados",
      value: input.businesses.length,
      formatter: "count",
      description: "Negocios persistidos en Supabase, incluidos los que aun no completan activacion.",
    },
    {
      key: "active_businesses_last_7_days",
      label: "Activos ultimos 7 dias",
      value: activeBusinessesLast7Days.length,
      formatter: "count",
      description:
        "Negocios con actividad reciente segun la ultima mutacion persistida del negocio, productos u ordenes.",
    },
    {
      key: "businesses_with_published_catalog",
      label: "Con catalogo activo",
      value: businessRows.filter((row) => row.activeProductsCount > 0).length,
      formatter: "count",
      description: "Negocios con al menos un producto activo y publicable en el storefront.",
    },
    {
      key: "businesses_with_orders",
      label: "Con al menos 1 pedido",
      value: businessRows.filter((row) => row.ordersCount > 0).length,
      formatter: "count",
      description: "Negocios que ya recibieron al menos un pedido persistido.",
    },
    {
      key: "total_platform_orders",
      label: "Pedidos totales",
      value: input.orders.length,
      formatter: "count",
      description: "Pedidos persistidos de plataforma, incluyendo historico cancelado.",
    },
    {
      key: "platform_gmv_total",
      label: "GMV total plataforma",
      value: totalPlatformGmv,
      formatter: "currency",
      description:
        "Suma de pedidos no cancelados y sin fiado pendiente; replica la definicion efectiva usada para ingresos del MVP.",
    },
  ];

  const recentBusinessesChart: AdminDashboardChartSection = {
    title: "Negocios creados",
    description: "Altas diarias de negocios persistidos en la ventana reciente.",
    points: buildRecentSeries(
      input.businesses.map((business) => business.createdAt),
      now,
      RECENT_SERIES_DAYS,
    ),
  };
  const ordersByDayChart: AdminDashboardChartSection = {
    title: "Pedidos por dia",
    description: "Conteo diario de pedidos persistidos en la plataforma.",
    points: buildRecentSeries(
      input.orders.map((order) => order.createdAt),
      now,
      RECENT_SERIES_DAYS,
    ),
  };
  const gmvByDayChart: AdminDashboardChartSection = {
    title: "GMV por dia",
    description:
      "Volumen diario basado en pedidos no cancelados y sin fiado pendiente dentro de la ventana reciente.",
    points: buildRecentWeightedSeries(
      input.orders.filter(isEffectiveGmvOrder),
      now,
      RECENT_SERIES_DAYS,
      (order) => order.total,
    ),
  };

  const funnel: AdminActivationFunnelStep[] = [
    {
      key: "account_created",
      label: "Cuenta creada",
      value: activationCandidateUserIds.size,
      measurement:
        "Perfiles operator-capable (`business_owner`) mas cuentas que ya son owner real de un negocio; no cuenta `customer` ni admins internos sin negocio.",
    },
    {
      key: "business_created",
      label: "Negocio creado",
      value: businessOwnerUserIds.size,
      measurement:
        "Usuarios que ya figuran como owner canonico en `businesses.created_by_user_id`.",
    },
    {
      key: "first_product_loaded",
      label: "Primer producto cargado",
      value: userIdsWithProducts.size,
      measurement:
        "Owners con al menos un producto persistido en cualquiera de sus negocios.",
    },
    {
      key: "published_catalog",
      label: "Catalogo activo/publicado",
      value: userIdsWithPublishedCatalog.size,
      measurement:
        "Owners con al menos un negocio que ya tiene un producto activo para el storefront.",
    },
    {
      key: "first_order_received",
      label: "Primer pedido recibido",
      value: userIdsWithOrders.size,
      measurement:
        "Owners con al menos un negocio que ya recibio un pedido persistido.",
    },
  ];

  const recentBusinesses = sortRowsByDateDesc(businessRows, (row) => row.createdAt).slice(0, 8);
  const businessesWithoutProducts = sortRowsByDateDesc(
    businessRows.filter((row) => row.productsCount === 0),
    (row) => row.createdAt,
  ).slice(0, 8);
  const businessesWithoutOrders = sortRowsByDateDesc(
    businessRows.filter((row) => row.ordersCount === 0),
    (row) => row.createdAt,
  ).slice(0, 8);
  const recentActivityBusinesses = sortRowsByDateDesc(
    activeBusinessesLast7Days,
    (row) => row.lastActivityAt,
  ).slice(0, 8);
  const incompleteActivationBusinesses = sortRowsByDateDesc(
    businessRows.filter((row) => row.activationStage.key !== "first_order_received"),
    (row) => row.createdAt,
  ).slice(0, 8);

  const notes: AdminDashboardMeasurementNote[] = [
    {
      key: "recent-activity",
      title: "Actividad reciente",
      description:
        "Se aproxima con la fecha mas reciente entre `businesses.updated_at`, productos del negocio y pedidos del negocio. No existe aun un event log separado de actividad.",
    },
    {
      key: "gmv",
      title: "Definicion de GMV usada hoy",
      description:
        "El GMV del panel replica la lectura efectiva del MVP: excluye pedidos cancelados y fiados que siguen en estado `pending`.",
    },
    {
      key: "funnel",
      title: "Embudo de activacion",
      description:
        "Se construye con estado persistido real de cuentas, negocios, productos y pedidos. No inventa eventos de onboarding que el esquema actual no guarda.",
    },
  ];

  return {
    generatedAt: now.toISOString(),
    kpis,
    charts: {
      recentBusinesses: recentBusinessesChart,
      ordersByDay: ordersByDayChart,
      gmvByDay: gmvByDayChart,
    },
    funnel,
    tables: {
      recentBusinesses,
      businessesWithoutProducts,
      businessesWithoutOrders,
      recentActivityBusinesses,
      incompleteActivationBusinesses,
    },
    notes,
  };
}

export async function getAdminDashboardSnapshot(
  viewer: AdminDashboardViewer,
): Promise<AdminDashboardSnapshot> {
  assertPlatformAdminAccess(viewer);

  const supabase = await createServerSupabaseAuthClient();
  const [
    profilesResult,
    businessesResult,
    productsResult,
    ordersResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("user_id, role, created_at, updated_at"),
    supabase
      .from("businesses")
      .select("id, slug, name, created_by_user_id, created_at, updated_at"),
    supabase
      .from("products")
      .select("id, business_id, is_available, created_at, updated_at"),
    supabase
      .from("orders")
      .select("id, business_id, total, status, is_fiado, fiado_status, created_at, updated_at"),
  ]);

  if (profilesResult.error) {
    throw new Error(
      `No fue posible leer user_profiles para el panel admin: ${profilesResult.error.message}`,
    );
  }

  if (businessesResult.error) {
    throw new Error(
      `No fue posible leer businesses para el panel admin: ${businessesResult.error.message}`,
    );
  }

  if (productsResult.error) {
    throw new Error(
      `No fue posible leer products para el panel admin: ${productsResult.error.message}`,
    );
  }

  if (ordersResult.error) {
    throw new Error(
      `No fue posible leer orders para el panel admin: ${ordersResult.error.message}`,
    );
  }

  return buildAdminDashboardSnapshot({
    profiles: mapUserProfiles((profilesResult.data ?? []) as UserProfileRow[]),
    businesses: mapBusinesses((businessesResult.data ?? []) as BusinessRow[]),
    products: mapProducts((productsResult.data ?? []) as ProductRow[]),
    orders: mapOrders((ordersResult.data ?? []) as OrderRow[]),
  });
}
