import type { ApplicationStatus } from "@/api/applications";
import type { OrderStatus } from "@/api/orders";
import type { SupportStatus } from "@/api/support";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  contactado: "Contactado",
  finalizado: "Finalizado",
  descartado: "Descartado",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  nueva: "Nueva",
  en_revision: "En revisión",
  entrevista: "Entrevista",
  descartada: "Descartada",
  contratada: "Contratada",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  abierto: "Abierto",
  respondido: "Respondido",
  cerrado: "Cerrado",
};

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
