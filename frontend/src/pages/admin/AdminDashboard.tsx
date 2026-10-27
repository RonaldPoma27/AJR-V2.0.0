import { useTranslation } from "react-i18next";
import { useOrderStats, type OrderStats } from "@/api/orders";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import Reveal from "@/components/ui/Reveal";
import { ORDER_TO_STEP, PROJECT_STEPS } from "@/lib/projectSteps";
import { PLAN_KEYS, PLAN_PRICE_USD } from "@/lib/plans";
import type { OrderStatus } from "@/api/orders";

function ChartCard({ title, desc, children, className }: { title: string; desc: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-surface p-5 ${className ?? ""}`}>
      <h2 className="font-semibold text-fg">{title}</h2>
      <p className="mb-4 text-sm text-fg-subtle">{desc}</p>
      {children}
    </section>
  );
}

function monthLabel(month: string, lang: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { month: "short" }).format(new Date(y, m - 1, 1));
}

function Charts({ stats }: { stats: OrderStats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const monthly = stats.by_month.map((m) => ({ label: monthLabel(m.month, lang), value: m.count }));
  const revenue = PLAN_KEYS.map((k) => ({ label: t(`dashboard.plans.${k}`), value: stats.by_plan[k] * PLAN_PRICE_USD[k] }));
  const plans = [...PLAN_KEYS, "sin-plan" as const]
    .map((k) => ({ label: t(`dashboard.plans.${k}`), value: stats.by_plan[k] }))
    .filter((d, i) => d.value > 0 || i < PLAN_KEYS.length);

  // Estados de pedido agrupados por etapa del proyecto (ver ORDER_TO_STEP).
  const byStep = PROJECT_STEPS.map((step, i) => ({
    label: t(`projectStepper.steps.${step}`),
    value: (Object.keys(ORDER_TO_STEP) as OrderStatus[])
      .filter((s) => ORDER_TO_STEP[s] === i + 1)
      .reduce((sum, s) => sum + (stats.by_status[s] ?? 0), 0),
  }));

  const domain = (["si", "no", "sin-dato"] as const)
    .map((k) => ({ label: t(`dashboard.domain.${k}`), value: stats.by_domain[k] }))
    .filter((d, i) => d.value > 0 || i < 2);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Reveal>
        <ChartCard title={t("dashboard.charts.monthly.title")} desc={t("dashboard.charts.monthly.desc")}>
          <BarChart data={monthly} ariaLabel={t("dashboard.charts.monthly.title")} />
        </ChartCard>
      </Reveal>
      <Reveal delay={100}>
        <ChartCard title={t("dashboard.charts.revenue.title")} desc={t("dashboard.charts.revenue.desc")}>
          <BarChart data={revenue} ariaLabel={t("dashboard.charts.revenue.title")} format={(n) => `$${n.toLocaleString(lang)}`} colorByBar />
        </ChartCard>
      </Reveal>
      <Reveal>
        <ChartCard title={t("dashboard.charts.status.title")} desc={t("dashboard.charts.status.desc")}>
          <DonutChart data={byStep} ariaLabel={t("dashboard.charts.status.title")} />
        </ChartCard>
      </Reveal>
      <Reveal delay={100}>
        <ChartCard title={t("dashboard.charts.plans.title")} desc={t("dashboard.charts.plans.desc")}>
          <DonutChart data={plans} ariaLabel={t("dashboard.charts.plans.title")} />
        </ChartCard>
      </Reveal>
      <Reveal className="lg:col-span-2">
        <ChartCard title={t("dashboard.charts.domain.title")} desc={t("dashboard.charts.domain.desc")}>
          <DonutChart data={domain} ariaLabel={t("dashboard.charts.domain.title")} />
        </ChartCard>
      </Reveal>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useOrderStats();
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("dashboard.title")}</h1>
        <p className="text-sm text-fg-subtle">{t("dashboard.subtitle")}</p>
      </div>
      {isLoading && <p className="text-fg-subtle">{t("dashboard.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("dashboard.loadError")} <button onClick={() => refetch()} className="font-medium underline">{t("dashboard.retry")}</button>
        </p>
      )}
      {data && <Charts stats={data} />}
    </div>
  );
}
