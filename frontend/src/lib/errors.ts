import { isAxiosError } from "axios";
import i18n from "@/i18n";
import { formatWait } from "@/lib/time";

/** Mensajes de error que manda el backend (en español) -> clave de traducción. */
const SERVER_MESSAGES: Record<string, string> = {
  "El envío de formularios no está disponible por el momento.": "serverErrors.formsUnavailable",
  "Completá la verificación anti-spam antes de enviar.": "serverErrors.antiSpamRequired",
  "No pudimos verificar que sos una persona. Recargá la página y probá de nuevo.": "serverErrors.antiSpamFailed",
  "No pudimos verificar el anti-spam. Probá de nuevo en unos minutos.": "serverErrors.antiSpamUnavailable",
  "Email o contraseña incorrectos": "serverErrors.invalidCredentials",
  "No se pudieron validar las credenciales": "serverErrors.sessionInvalid",
  "Recurso no encontrado": "serverErrors.notFound",
  "Requiere rol ADMIN": "serverErrors.requiresAdmin",
  "Requiere rol TECHNICIAN o ADMIN": "serverErrors.requiresStaff",
  "El email actual no coincide con el de tu cuenta": "serverErrors.currentEmailMismatch",
  "El email nuevo tiene que ser distinto del actual": "serverErrors.newEmailSame",
  "La contraseña actual no es correcta": "serverErrors.currentPasswordWrong",
  "La contraseña no es correcta": "serverErrors.passwordWrong",
  "La contraseña nueva tiene que ser distinta de la actual": "serverErrors.newPasswordSame",
  "El email ya está registrado": "serverErrors.emailTaken",
  "Solo el cliente dueño del ticket puede aprobar el presupuesto.": "serverErrors.onlyOwnerApproves",
  "Esa IP no está bloqueada.": "serverErrors.ipNotBlocked",
  "Esa cuenta no es TECHNICIAN.": "serverErrors.notTechnician",
  "No está en la papelera": "serverErrors.notInTrash",
  "No hay ningún usuario registrado con ese email.": "serverErrors.noUserWithEmail",
  "Postulación no encontrada": "serverErrors.applicationNotFound",
  "Esa cuenta es ADMIN: ya tiene todos los permisos.": "serverErrors.accountIsAdmin",
  "Esa cuenta ya es TECHNICIAN.": "serverErrors.alreadyTechnician",
  "Este chat está cerrado.": "serverErrors.chatClosed",
  "Debes indicar estimated_cost para pedir la aprobación del cliente.": "serverErrors.estimatedCostRequired",
  "Enviaste demasiados formularios en poco tiempo. Probá de nuevo en un rato.": "serverErrors.tooManyForms",
};

/**
 * Mensaje `detail` del backend, traducido al idioma activo. Si el texto no está en el
 * diccionario (p. ej. un mensaje nuevo), se muestra tal cual vino.
 * Los bloqueos por IP (429 de ip_guard) se arman acá con el tiempo restante.
 */
export function getServerDetail(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const response = error.response;
  if (response?.status === 429) {
    const retryAfter = Number(response.headers?.["retry-after"] ?? response.data?.retry_after);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      const banned = response.data?.code === "ip_banned";
      return i18n.t(banned ? "serverErrors.ipBanned" : "serverErrors.loginLocked", {
        time: formatWait(retryAfter),
      });
    }
  }
  const detail = response?.data?.detail;
  if (typeof detail !== "string") return undefined;
  const key = SERVER_MESSAGES[detail];
  return key ? i18n.t(key) : detail;
}

/** Error legible para los formularios públicos (pedido / postulación). */
export function getFormErrorMessage(error: unknown, what: "order" | "application"): string {
  const kind = what === "order" ? "Order" : "Application";
  if (isAxiosError(error)) {
    if (!error.response) return i18n.t("serverErrors.connection");
    const { status } = error.response;
    if (status === 422) return i18n.t("serverErrors.invalidFields");
    if (status === 400 || status === 429 || status === 503) {
      return getServerDetail(error) ?? i18n.t(`serverErrors.sendFailed${kind}`);
    }
    if (status === 404) return i18n.t("serverErrors.serviceUnavailable404");
    return i18n.t(`serverErrors.sendErrorCode${kind}`, { status });
  }
  return i18n.t(`serverErrors.sendError${kind}`);
}
