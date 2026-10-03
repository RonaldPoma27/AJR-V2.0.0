import { isAxiosError } from "axios";

/** Mensaje `detail` que manda el backend (ya viene en español), si es un texto. */
export function getServerDetail(error: unknown): string | undefined {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

/** Error legible para los formularios públicos (pedido / postulación). */
export function getFormErrorMessage(error: unknown, what: string): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.";
    }
    const { status } = error.response;
    if (status === 422) {
      return "Revisá que todos los campos estén completos y sean válidos.";
    }
    if (status === 400 || status === 429 || status === 503) {
      return getServerDetail(error) ?? `No pudimos enviar tu ${what}. Probá de nuevo en un rato.`;
    }
    if (status === 404) {
      return "El servicio no está disponible en este momento (404). Avisale al equipo técnico.";
    }
    return `Ocurrió un error al enviar tu ${what} (código ${status}). Probá de nuevo.`;
  }
  return `Ocurrió un error al enviar tu ${what}. Probá de nuevo.`;
}
