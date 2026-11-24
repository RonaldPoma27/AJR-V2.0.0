import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { ClientOrder, OrderStatus } from "@/api/orders";

const PLAN_DEFS = [
  { id: "presencia-digital", key: "presence", price: 100, color: "#22d3ee" },
  { id: "web-gestion", key: "management", price: 250, color: "#818cf8" },
  { id: "sistema-medida", key: "custom", price: 450, color: "#e879f9" },
] as const;

const STATUS_DEFS: { id: OrderStatus; color: string }[] = [
  { id: "nuevo", color: "#22d3ee" },
  { id: "en_revision", color: "#818cf8" },
  { id: "contactado", color: "#a78bfa" },
  { id: "finalizado", color: "#34d399" },
  { id: "descartado", color: "#94a3b8" },
];

function extractPlan(description: string): string | null {
  const match = description.match(/Plan:\s*([^\r\n]+)/i);
  const value = match?.[1]?.trim();
  return PLAN_DEFS.some((p) => p.id === value) ? value! : null;
}

function RingChart({ title, entries }: { title: string; entries: { label: string; value: number; color: string }[] }) {
  const { t } = useTranslation();
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  let offset = 0;
  const stops = entries.map((entry) => {
    const from = offset;
    offset += total ? (entry.value / total) * 100 : 0;
    return `${entry.color} ${from}% ${offset}%`;
  });
  const style: CSSProperties = { background: total ? `conic-gradient(${stops.join(", ")})` : "rgb(148 163 184 / 0.22)" };

  return (
    <section className="rounded-xl border border-line bg-surface/80 p-5 shadow-sm">
      <h3 className="font-semibold text-fg">{title}</h3>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <div className="relative h-28 w-28 shrink-0 rounded-full p-3" style={style} role="img" aria-label={t("dashboardCharts.ringAlt", { title, total })}>
          <div className="flex h-full w-full items-center justify-center rounded-full bg-surface text-center">
            <span className="text-xl font-bold tabular-nums text-fg">{total}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {entries.map((entry) => (
            <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-fg-muted"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} /> <span className="truncate">{entry.label}</span></span>
              <span className="font-semibold tabular-nums text-fg">{entry.value}</span>
            </li>
          ))}
          {total === 0 && <li className="text-sm text-fg-subtle">{t("dashboardCharts.noData")}</li>}
        </ul>
      </div>
    </section>
  );
}

function BarChart({ title, entries, valuePrefix = "", valueSuffix = "", locale }: { title: string; entries: { label: string; value: number; color?: string }[]; valuePrefix?: string; valueSuffix?: string; locale: string }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <section className="rounded-xl border border-line bg-surface/80 p-5 shadow-sm">
      <h3 className="font-semibold text-fg">{title}</h3>
      <div className="mt-5 space-y-4">
        {entries.map((entry) => (
          <div key={entry.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="text-fg-muted">{entry.label}</span>
              <span className="font-semibold tabular-nums text-fg">{valuePrefix}{entry.value.toLocaleString(locale)}{valueSuffix}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${entry.label}: ${valuePrefix}${entry.value}${valueSuffix}`}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(entry.value / max) * 100}%`, background: entry.color ?? "linear-gradient(90deg, #22d3ee, #818cf8)" }} />
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-fg-subtle">{t("dashboardCharts.noData")}</p>}
      </div>
    </section>
  );
}

export default function DashboardCharts({ orders, counts }: { orders: ClientOrder[]; counts: Record<string, number> }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? "en-US" : "es-AR";
  const monthCursor = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - (5 - i), 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(date) };
  });
  const monthlyEntries = months.map((month) => ({
    label: month.label,
    value: orders.filter((order) => order.created_at.startsWith(month.key)).length,
  }));

  const planCounts: { label: string; value: number; color: string }[] = PLAN_DEFS.map((plan) => ({
    label: t(`pubHome.pricingPlans.${plan.key}.name`),
    value: orders.filter((order) => extractPlan(order.problem_description) === plan.id).length,
    color: plan.color,
  }));
  const noPlan = orders.filter((order) => !extractPlan(order.problem_description)).length;
  if (noPlan) planCounts.push({ label: t("dashboardCharts.noPlan"), value: noPlan, color: "#94a3b8" });

  const incomeEntries = PLAN_DEFS.map((plan) => ({
    label: t(`pubHome.pricingPlans.${plan.key}.name`),
    value: orders.filter((order) => extractPlan(order.problem_description) === plan.id).length * plan.price,
    color: plan.color,
  }));

  const hostingYes = orders.filter((order) => /Dominio\/hosting:\s*s[ií]/i.test(order.problem_description)).length;
  const hostingNo = orders.filter((order) => /Dominio\/hosting:\s*no/i.test(order.problem_description)).length;
  const hostingUnknown = orders.length - hostingYes - hostingNo;
  const hostingEntries = [
    { label: t("dashboardCharts.hostingNeeded"), value: hostingYes, color: "#22d3ee" },
    { label: t("dashboardCharts.hostingNotNeeded"), value: hostingNo, color: "#818cf8" },
    { label: t("dashboardCharts.hostingUnknown"), value: hostingUnknown, color: "#94a3b8" },
  ];

  const statusEntries = STATUS_DEFS.map((status) => ({
    label: t(`orderStatus.${status.id}`),
    value: counts[status.id] ?? 0,
    color: status.color,
  }));

  return (
    <section className="space-y-3" aria-labelledby="dashboard-analytics-title">
      <div>
        <h2 id="dashboard-analytics-title" className="text-lg font-semibold text-fg">{t("dashboardCharts.title")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{t("dashboardCharts.note")}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <BarChart title={t("dashboardCharts.monthlyRequests")} entries={monthlyEntries} locale={locale} />
        <BarChart title={t("dashboardCharts.estimatedRevenue")} entries={incomeEntries} valuePrefix="USD " locale={locale} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <RingChart title={t("dashboardCharts.statusDistribution")} entries={statusEntries} />
        <RingChart title={t("dashboardCharts.planDistribution")} entries={planCounts} />
        <RingChart title={t("dashboardCharts.hostingDistribution")} entries={hostingEntries} />
      </div>
    </section>
  );
}
