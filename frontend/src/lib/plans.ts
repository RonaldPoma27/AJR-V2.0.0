/** Planes, presupuestos y plazos del formulario de pedidos (las mismas claves las valida el backend). */
export const PLAN_KEYS = ["presencia-digital", "web-gestion", "sistema-medida"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** Precio base ("desde") en USD de cada plan. */
export const PLAN_PRICE_USD: Record<PlanKey, number> = {
  "presencia-digital": 100,
  "web-gestion": 250,
  "sistema-medida": 450,
};

export const BUDGET_KEYS = ["lt-250", "250-499", "500-1499", "gte-1500"] as const;
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const TIMELINE_KEYS = ["1-2-semanas", "1-mes", "2-3-meses", "explorando"] as const;
export type TimelineKey = (typeof TIMELINE_KEYS)[number];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}
