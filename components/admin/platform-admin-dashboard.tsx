import type {
  AdminActivationFunnelStep,
  AdminBusinessOperationalRow,
  AdminDashboardChartSection,
  AdminDashboardKpi,
  AdminDashboardMeasurementNote,
  AdminDashboardSnapshot,
} from "@/types/admin-dashboard";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");

function formatKpiValue(kpi: AdminDashboardKpi) {
  return kpi.formatter === "currency"
    ? currencyFormatter.format(kpi.value)
    : numberFormatter.format(kpi.value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function normalizeChartPoints(points: AdminDashboardChartSection["points"]) {
  const maxValue = Math.max(...points.map((point) => point.value), 0);
  return points.map((point) => ({
    ...point,
    ratio: maxValue > 0 ? point.value / maxValue : 0,
  }));
}

function KpiGrid({ kpis }: { kpis: AdminDashboardKpi[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <article
          key={kpi.key}
          data-testid={`admin-kpi-${kpi.key}`}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {kpi.label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {formatKpiValue(kpi)}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{kpi.description}</p>
        </article>
      ))}
    </section>
  );
}

function BarChartSection({
  section,
  formatter,
  testId,
}: {
  section: AdminDashboardChartSection;
  formatter: (value: number) => string;
  testId: string;
}) {
  const normalizedPoints = normalizeChartPoints(section.points);
  const hasValues = normalizedPoints.some((point) => point.value > 0);

  return (
    <article
      data-testid={testId}
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {section.title}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{section.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>

      {hasValues ? (
        <div className="mt-5">
          <div className="flex h-56 items-end gap-2 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
            {normalizedPoints.map((point) => (
              <div
                key={point.key}
                className="flex min-w-[3.5rem] flex-1 flex-col items-center justify-end gap-3"
              >
                <span className="text-[11px] font-semibold text-slate-500">
                  {formatter(point.value)}
                </span>
                <div className="flex h-36 items-end">
                  <div
                    className="w-9 rounded-t-2xl bg-[linear-gradient(180deg,#0f172a_0%,#1d4ed8_100%)] shadow-[0_12px_24px_rgba(29,78,216,0.24)]"
                    style={{
                      height: `${Math.max(point.ratio * 100, 6)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600">
          Todavia no hay suficientes registros recientes para dibujar esta serie con datos reales.
        </div>
      )}
    </article>
  );
}

function FunnelSection({ steps }: { steps: AdminActivationFunnelStep[] }) {
  const topValue = Math.max(steps[0]?.value ?? 0, 1);

  return (
    <section
      data-testid="admin-activation-funnel"
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Embudo de activacion
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
        Hasta donde llegan hoy las cuentas operativas
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        El embudo usa solo estado persistido real. Cada paso documenta exactamente que se esta
        midiendo en este MVP.
      </p>

      <div className="mt-5 space-y-4">
        {steps.map((step) => {
          const ratio = topValue > 0 ? step.value / topValue : 0;

          return (
            <article
              key={step.key}
              className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-950">{step.label}</h3>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {formatCount(step.value)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.measurement}</p>
                </div>

                <div className="w-full max-w-xs">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#0ea5e9_100%)]"
                      style={{ width: `${Math.max(ratio * 100, step.value > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs font-medium text-slate-500">
                    {Math.round(ratio * 100)}% del primer paso
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActivationStageBadge({
  stage,
}: {
  stage: AdminBusinessOperationalRow["activationStage"];
}) {
  const toneClassName =
    stage.key === "first_order_received"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : stage.key === "published_catalog"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : stage.key === "first_product_loaded"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClassName}`}>
      {stage.label}
    </span>
  );
}

function OperationalTable({
  title,
  description,
  rows,
  emptyMessage,
  testId,
}: {
  title: string;
  description: string;
  rows: AdminBusinessOperationalRow[];
  emptyMessage: string;
  testId: string;
}) {
  return (
    <article
      data-testid={testId}
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

      {rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2 text-right">Productos</th>
                <th className="px-3 py-2 text-right">Pedidos</th>
                <th className="px-3 py-2 text-right">GMV</th>
                <th className="px-3 py-2">Ultima actividad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.businessId}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 text-sm text-slate-700"
                >
                  <td className="rounded-l-[22px] px-3 py-3 align-top">
                    <p className="font-semibold text-slate-950">{row.businessName}</p>
                    <p className="mt-1 text-xs text-slate-500">/{row.businessSlug}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Creado: {formatDate(row.createdAt)}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <ActivationStageBadge stage={row.activationStage} />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {row.activationStage.description}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <p className="font-semibold text-slate-950">{formatCount(row.productsCount)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCount(row.activeProductsCount)} activos
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <p className="font-semibold text-slate-950">{formatCount(row.ordersCount)}</p>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <p className="font-semibold text-slate-950">{formatCurrency(row.effectiveGmv)}</p>
                  </td>
                  <td className="rounded-r-[22px] px-3 py-3 align-top">
                    <p className="text-sm font-medium text-slate-700">
                      {formatDateTime(row.lastActivityAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      owner: {row.createdByUserId ?? "sin owner"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600">
          {emptyMessage}
        </div>
      )}
    </article>
  );
}

function NotesSection({ notes }: { notes: AdminDashboardMeasurementNote[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Notas de medicion
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
        Lo que el panel mide de verdad
      </h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {notes.map((note) => (
          <article
            key={note.key}
            className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
          >
            <h3 className="text-base font-semibold text-slate-950">{note.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{note.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PlatformAdminDashboard({
  snapshot,
}: {
  snapshot: AdminDashboardSnapshot;
}) {
  return (
    <div data-testid="admin-platform-dashboard" className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] p-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
              Panel de plataforma
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Admin Tecpify
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              Vista interna para leer activacion, demanda y salud operativa de toda la plataforma
              sobre datos reales persistidos en Supabase.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            Snapshot generado: {formatDateTime(snapshot.generatedAt)}
          </div>
        </div>
      </section>

      <KpiGrid kpis={snapshot.kpis} />

      <section className="grid gap-4 xl:grid-cols-3">
        <BarChartSection
          section={snapshot.charts.recentBusinesses}
          formatter={formatCount}
          testId="admin-chart-recent-businesses"
        />
        <BarChartSection
          section={snapshot.charts.ordersByDay}
          formatter={formatCount}
          testId="admin-chart-orders-by-day"
        />
        <BarChartSection
          section={snapshot.charts.gmvByDay}
          formatter={formatCurrency}
          testId="admin-chart-gmv-by-day"
        />
      </section>

      <FunnelSection steps={snapshot.funnel} />

      <section className="grid gap-4 xl:grid-cols-2">
        <OperationalTable
          title="Negocios mas recientes"
          description="Altas nuevas ordenadas por fecha de creacion real."
          rows={snapshot.tables.recentBusinesses}
          emptyMessage="Todavia no hay negocios persistidos para listar."
          testId="admin-table-recent-businesses"
        />
        <OperationalTable
          title="Negocios sin productos"
          description="Negocios que aun no cargan el primer producto y siguen frenados en activacion."
          rows={snapshot.tables.businessesWithoutProducts}
          emptyMessage="No hay negocios sin productos en este momento."
          testId="admin-table-businesses-without-products"
        />
        <OperationalTable
          title="Negocios sin pedidos"
          description="Negocios que ya existen, pero aun no reciben el primer pedido persistido."
          rows={snapshot.tables.businessesWithoutOrders}
          emptyMessage="Todos los negocios listados ya tienen al menos un pedido."
          testId="admin-table-businesses-without-orders"
        />
        <OperationalTable
          title="Actividad reciente"
          description="Negocios con movimiento persistido en los ultimos 7 dias segun la mejor aproximacion honesta disponible hoy."
          rows={snapshot.tables.recentActivityBusinesses}
          emptyMessage="No hay actividad reciente suficiente para esta vista."
          testId="admin-table-recent-activity"
        />
      </section>

      <OperationalTable
        title="Activacion incompleta"
        description="Negocios que todavia no alcanzan el primer pedido recibido segun el estado real de catalogo y pedidos."
        rows={snapshot.tables.incompleteActivationBusinesses}
        emptyMessage="Todos los negocios listados ya completaron la activacion minima del MVP."
        testId="admin-table-incomplete-activation"
      />

      <NotesSection notes={snapshot.notes} />
    </div>
  );
}
