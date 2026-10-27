import { useInView } from "@/lib/useInView";
import { chartColor } from "./palette";

export interface BarDatum {
  label: string;
  value: number;
}

const W = 520;
const H = 240;
const PAD = { top: 20, right: 12, bottom: 34, left: 40 };

/** Redondea el máximo hacia arriba a un valor "lindo" (el eje se divide en 4 tramos enteros). */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const m = [1, 2, 3, 4, 5, 10].find((x) => f <= x) ?? 10;
  return m * pow * 4;
}

/**
 * Gráfico de barras en SVG (sin librerías). Las barras "crecen" al entrar al viewport.
 * `format` da formato a los valores (por ejemplo, "USD 450"). Los datos también quedan disponibles
 * para lectores de pantalla en una lista oculta.
 */
export default function BarChart({
  data,
  ariaLabel,
  format = (n) => String(n),
  colorByBar = false,
}: {
  data: BarDatum[];
  ariaLabel: string;
  format?: (n: number) => string;
  colorByBar?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(44, slot * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        {ticks.map((tk) => {
          const y = PAD.top + innerH - innerH * tk;
          return (
            <g key={tk}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-fg-subtle" fontSize={10}>
                {format(Math.round(max * tk))}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = max === 0 ? 0 : (d.value / max) * innerH;
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const y = PAD.top + innerH - h;
          return (
            <g key={d.label + i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={chartColor(colorByBar ? i : 0)}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "bottom",
                  transform: inView ? "scaleY(1)" : "scaleY(0)",
                  transition: `transform 600ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms`,
                }}
              />
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-fg" fontSize={10} fontWeight={600} style={{ opacity: inView ? 1 : 0, transition: `opacity 400ms ease ${300 + i * 50}ms` }}>
                  {format(d.value)}
                </text>
              )}
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" className="fill-fg-muted" fontSize={11}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">
        {data.map((d, i) => (
          <li key={d.label + i}>
            {d.label}: {format(d.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}
