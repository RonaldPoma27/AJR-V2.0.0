import type { ApplicationStatus } from "@/api/applications";
import type { OrderStatus } from "@/api/orders";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  contactado: "Contactado",
  descartado: "Descartado",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  nueva: "Nueva",
  en_revision: "En revisión",
  entrevista: "Entrevista",
  descartada: "Descartada",
  contratada: "Contratada",
};

/** Colores de la etiqueta de estado (Tailwind). */
export const STATUS_BADGE: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  nueva: "bg-blue-100 text-blue-700",
  en_revision: "bg-amber-100 text-amber-700",
  contactado: "bg-green-100 text-green-700",
  entrevista: "bg-purple-100 text-purple-700",
  contratada: "bg-green-100 text-green-700",
  descartado: "bg-gray-200 text-gray-600",
  descartada: "bg-gray-200 text-gray-600",
};
