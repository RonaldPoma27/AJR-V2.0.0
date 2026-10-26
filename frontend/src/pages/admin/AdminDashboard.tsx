import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOrderStats, type OrderStats } from "@/api/orders";
import { dateLocale } from "@/i18n";
import { useTheme } from "@/lib/theme";
import { PROJECT_STEPS } from "@/lib/plans";

/** Paleta de los gráficos: la misma gama cian → azul → violeta del sitio, más ámbar y verde de estado. */
const COLORS = {
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  emerald: "#10b981",
};
const STEP_COLORS = [COLORS.cyan, COLORS.blue, COLORS.violet, COLORS.amber, COLORS.emerald];
const PLAN_COLORS = [COLORS.cyan, COLORS.indigo, COLORS.violet];

/** Los elementos SVG no resuelven bien variables CSS: los colores de ejes y grilla salen del tema. */
function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    axis: dark ? "#9ca3af" : "#6b7280",
    grid: dark ? "#374151" : "#e5e7eb",
    cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
    animate: !reduceMotion,
  };
}

/** Tooltip HTML (no SVG): sí puede usar los tokens CSS del sitio. */
const tooltipStyle = {
  background: "rgb(var(--c-surface))",
  border: "1px solid rgb(var(--c-line))",
  borderRadius: 8,
  color: "rgb(var(--c-fg))",
  fontSize: 13,
} as const;

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border bg-surface p-5 ${className ?? ""}`}>
      <h2 className="font-semibold text-fg">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-fg-subtle">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** "2026-10" → "oct". Se aclara el año en enero y en el primer mes de la serie, para no perder el hilo. */
function monthLabel(key: string, forceYear = false): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const short = date.toLocaleDateString(dateLocale(), { month: "short", timeZone: "UTC" });
  return month === 1 || forceYear ? `${short} ${String(year).slice(2)}` : short;
}

/** Barras: solicitudes por mes. */
function MonthlyRequestsChart({ stats }: { stats: OrderStats }) {
  const { t } = useTranslation();
  const c = useChartTheme();
  const data = stats.by_month.map((m, i) => ({
    label: monthLabel(m.month, i === 0),
    count: m.count,
  }));
  return (
    <ChartCard title={t("dashboard.monthly.title")} description={t("dashboard.monthly.description")}>
      <div className="h-64" role="img" aria-label={t("dashboard.monthly.title")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: c.cursor }}
              contentStyle={tooltipStyle}
              formatter={(value) => [value, t("dashboard.monthly.series")]}
            />
            <Bar dataKey="count" fill={COLORS.indigo} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={c.animate} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Barras: ingresos estimados por plan (cantidad × precio "desde"). */
function RevenueByPlanChart({ stats }: { stats: OrderStats }) {
  const { t } = useTranslation();
  const c = useChartTheme();
  const data = stats.by_plan.map((p) => ({
    name: t(`pricing.plans.${p.plan}.name`),
    usd: p.estimated_usd,
    count: p.count,
  }));
  const total = stats.by_plan.reduce((sum, p) => sum + p.estimated_usd, 0);
  return (
    <ChartCard
      title={t("dashboard.revenue.title")}
      description={t("dashboard.revenue.description", { total: `USD ${total.toLocaleString(dateLocale())}` })}
    >
      <div className="h-64" role="img" aria-label={t("dashboard.revenue.title")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} />
            <YAxis
              tick={{ fill: c.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              cursor={{ fill: c.cursor }}
              contentStyle={tooltipStyle}
              formatter={(value, _name, item) => [
                `USD ${Number(value).toLocaleString(dateLocale())} · ${t("dashboard.projectsCount", { count: item?.payload?.count ?? 0 })}`,
                t("dashboard.revenue.series"),
              ]}
            />
            <Bar dataKey="usd" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={c.animate}>
              {data.map((_, i) => (
                <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-fg-subtle">{t("dashboard.revenue.note")}</p>
    </ChartCard>
  );
}

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Anillo con leyenda en texto (cantidad y porcentaje): sirve también para lectores de pantalla. */
function DonutCard({ title, description, slices }: { title: string; description?: string; slices: Slice[] }) {
  const { t } = useTranslation();
  const c = useChartTheme();
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const pct = (value: number) => (total ? Math.round((value / total) * 100) : 0);

  return (
    <ChartCard title={title} description={description}>
      {total === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-fg-subtle">{t("dashboard.noData")}</p>
      ) : (
        <>
          <div className="relative mx-auto h-44 w-44" role="img" aria-label={title}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={slices.filter((s) => s.value > 0).length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={c.animate}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [`${value} (${pct(Number(value))}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-fg">{total}</span>
              <span className="text-xs text-fg-subtle">{t("dashboard.total")}</span>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 text-fg-muted">{s.label}</span>
                <span className="font-medium text-fg">{s.value}</span>
                <span className="w-10 text-right text-fg-subtle">{pct(s.value)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useOrderStats();

  const stepSlices = useMemo<Slice[]>(
    () =>
      (data?.by_step ?? []).map((s, i) => ({
        key: PROJECT_STEPS[i],
        label: t(`projectStepper.steps.${PROJECT_STEPS[i]}`),
        value: s.count,
        color: STEP_COLORS[i],
      })),
    [data, t]
  );
  const planSlices = useMemo<Slice[]>(
    () =>
      (data?.by_plan ?? []).map((p, i) => ({
        key: p.plan,
        label: t(`pricing.plans.${p.plan}.name`),
        value: p.count,
        color: PLAN_COLORS[i % PLAN_COLORS.length],
      })),
    [data, t]
  );
  const domainSlices = useMemo<Slice[]>(
    () =>
      data
        ? [
            { key: "own", label: t("dashboard.domain.own"), value: data.domain.own_domain, color: COLORS.emerald },
            { key: "hosting", label: t("dashboard.domain.hosting"), value: data.domain.needs_hosting, color: COLORS.violet },
          ]
        : [],
    [data, t]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("dashboard.title")}</h1>
        <p className="text-sm text-fg-subtle">
          {data ? t("dashboard.subtitle", { count: data.total }) : t("dashboard.subtitleEmpty")}
        </p>
      </div>

      {isLoading && <p className="text-fg-subtle">{t("dashboard.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("dashboard.loadError")}{" "}
          <button onClick={() => refetch()} className="font-medium underline">
            {t("adminCommon.retry")}
          </button>
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <MonthlyRequestsChart stats={data} />
            <RevenueByPlanChart stats={data} />
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <DonutCard title={t("dashboard.steps.title")} description={t("dashboard.steps.description")} slices={stepSlices} />
            <DonutCard title={t("dashboard.plans.title")} description={t("dashboard.plans.description")} slices={planSlices} />
            <DonutCard title={t("dashboard.domain.title")} description={t("dashboard.domain.description")} slices={domainSlices} />
          </div>
        </>
      )}
    </div>
  );
}
