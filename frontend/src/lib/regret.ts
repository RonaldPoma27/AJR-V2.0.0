/**
 * Reglas del botón de arrepentimiento (Res. 424/2020 · Ley 24.240 art. 34).
 * Funciones puras (sin React ni red): fáciles de probar. La fuente de verdad es SIEMPRE el
 * backend; esto solo decide si mostramos el botón habilitado.
 */
export const REGRET_WINDOW_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Límite del plazo: 10 días corridos desde la contratación (misma regla que el backend). */
export function regretDeadline(createdAt: string | Date): Date {
  return new Date(new Date(createdAt).getTime() + REGRET_WINDOW_DAYS * DAY_MS);
}

/** Habilitado solo con MENOS de 10 días corridos de antigüedad y sin arrepentimiento previo. */
export function canRegret(createdAt: string | Date, now: number, requestedAt?: string | null): boolean {
  if (requestedAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now < created + REGRET_WINDOW_DAYS * DAY_MS;
}
