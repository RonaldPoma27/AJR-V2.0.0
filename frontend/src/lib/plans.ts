/**
 * Catálogo de planes y opciones del formulario de pedido.
 * Los valores (slugs) son los mismos que valida el backend (app/schemas/client_order.py);
 * los textos visibles salen de i18n (`pricing.plans.<slug>.*`, `requestForm.*`).
 */
export const PLAN_SLUGS = ["presencia-digital", "web-gestion", "sistema-a-medida"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

/** Precio "desde" en USD. El backend usa los mismos valores para los ingresos estimados. */
export const PLAN_PRICE_USD: Record<PlanSlug, number> = {
  "presencia-digital": 100,
  "web-gestion": 250,
  "sistema-a-medida": 450,
};

export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === "string" && (PLAN_SLUGS as readonly string[]).includes(value);
}

export const BUDGET_SLUGS = ["lt-100", "100-250", "250-450", "450-plus"] as const;
export type BudgetSlug = (typeof BUDGET_SLUGS)[number];

export const TIMELINE_SLUGS = ["1-2-weeks", "1-month", "2-3-months", "exploring"] as const;
export type TimelineSlug = (typeof TIMELINE_SLUGS)[number];

/** Pasos del proyecto que ve el cliente (ProjectStepper). El valor guardado va de 1 a 5. */
export const PROJECT_STEPS = ["analysis", "design", "development", "review", "delivered"] as const;
export const PROJECT_STEP_COUNT = PROJECT_STEPS.length;
