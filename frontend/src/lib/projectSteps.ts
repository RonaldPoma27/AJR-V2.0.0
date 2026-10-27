import type { OrderStatus } from "@/api/orders";

/** Etapas del proyecto que ve el cliente (ProjectStepper). */
export const PROJECT_STEPS = ["analysis", "design", "development", "review", "delivered"] as const;
export type ProjectStepKey = (typeof PROJECT_STEPS)[number];

/**
 * Qué etapa (1-5) corresponde a cada estado de pedido. Es el único lugar donde se define esta
 * equivalencia: si más adelante el backend guarda la etapa real del proyecto, se reemplaza acá.
 * `descartado` no tiene etapa (0): no se dibuja el stepper.
 */
export const ORDER_TO_STEP: Record<OrderStatus, number> = {
  nuevo: 1,
  en_revision: 2,
  contactado: 3,
  finalizado: 5,
  descartado: 0,
};
