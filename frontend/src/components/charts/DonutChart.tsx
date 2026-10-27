import { useTranslation } from "react-i18next";
import { useInView } from "@/lib/useInView";
import { chartColor } from "./palette";

export interface DonutDatum {
  label: string;
  value: number;
}

const R = 15.9155; // circunferencia = 100: los valores de dash son porcentajes directos

/** Gráfico de anillo en SVG con leyenda. Los tramos se dibujan al entrar al viewport. */
export default function DonutChart({ data, ariaLabel }: { data: DonutDatum[]; ariaLabel: string }) {
  const { t } = useTranslation();
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let offset = 0;

  return (
    <div ref={ref} className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 40 40" role="img" aria-label={ariaLabel} className="h-full w-full -rotate-90">
          <circle cx={20} cy={20} r={R} fill="none" strokeWidth={5} className="stroke-surface-2" />
          {total > 0 &&
            data.map((d, i) => {
              if (d.value === 0) return null;
              const pct = (d.value / total) * 100;
              const gap = data.filter((x) => x.value > 0).length > 1 ? 0.6 : 0;
              const el = (
                <circle
                  key={d.label}
                  cx={20}
                  cy={20}
                  r={R}
                  fill="none"
                  strokeWidth={5}
                  stroke={chartColor(i)}
                  strokeDasharray={`${inView ? Math.max(pct - gap, 0) : 0} ${100 - (inView ? Math.max(pct - gap, 0) : 0)}`}
                  strokeDashoffset={-offset}
                  style={{ transition: `stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms` }}
                />
              );
              offset += pct;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-fg">{total}</span>
          <span className="text-xs text-fg-subtle">{total === 0 ? t("dashboard.noData") : t("dashboard.total")}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: chartColor(i) }} />
            <span className="min-w-0 flex-1 truncate text-fg-muted">{d.label}</span>
            <span className="font-medium text-fg">{d.value}</span>
            <span className="w-11 text-right text-xs text-fg-subtle">{total ? `${Math.round((d.value / total) * 100)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
