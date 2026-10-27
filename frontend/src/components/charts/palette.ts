/** Colores sólidos para los gráficos (se distinguen en modo claro y oscuro). */
export const CHART_COLORS = ["#1d6ae5", "#7c3aed", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899"] as const;
export const chartColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
