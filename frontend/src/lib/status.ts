import i18n from "@/i18n";
import type { ApplicationStatus } from "@/api/applications";
import type { OrderStatus } from "@/api/orders";
import type { SupportStatus } from "@/api/support";

/**
 * Etiquetas de estado traducidas. Son getters: cada lectura consulta el idioma activo, así que
 * `ORDER_STATUS_LABELS[status]` sigue funcionando igual y cambia al alternar ES/EN
 * (el componente se vuelve a renderizar con `useTranslation`).
 */
function translatedLabels<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const labels = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(labels, key, { enumerable: true, get: () => i18n.t(`${prefix}.${key}`) });
  }
  return labels;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = translatedLabels("orderStatus", [
  "nuevo",
  "en_revision",
  "contactado",
  "finalizado",
  "descartado",
] as const);

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = translatedLabels(
  "applicationStatus",
  ["nueva", "en_revision", "entrevista", "descartada", "contratada"] as const
);

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = translatedLabels("supportStatus", [
  "abierto",
  "respondido",
  "cerrado",
] as const);

const BLUE = "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300";
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
const GREEN = "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300";
const PURPLE = "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300";
const GRAY = "bg-gray-200 text-gray-700 dark:bg-gray-500/25 dark:text-gray-300";

/** Colores de la etiqueta de estado (con variante para modo oscuro). */
export const STATUS_BADGE: Record<string, string> = {
  nuevo: BLUE,
  nueva: BLUE,
  abierto: AMBER,
  en_revision: AMBER,
  contactado: PURPLE,
  entrevista: PURPLE,
  respondido: GREEN,
  finalizado: GREEN,
  contratada: GREEN,
  descartado: GRAY,
  descartada: GRAY,
  cerrado: GRAY,
};
