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
  "La contraseña actual no es correcta.": "serverErrors.backupEmailPasswordWrong",
  "El correo de respaldo debe ser distinto del correo principal.": "serverErrors.backupEmailPrimarySame",
  "Ese correo ya se utiliza como correo principal de una cuenta.": "serverErrors.backupEmailPrimaryTaken",
  "Ese correo ya está configurado como respaldo en otra cuenta.": "serverErrors.backupEmailTaken",
  "Ese correo ya está verificado como correo de respaldo.": "serverErrors.backupEmailAlreadyVerified",
  "Ese correo ya tiene una verificación pendiente. Podés reenviar el código.": "serverErrors.backupEmailAlreadyPending",
  "Esperá un momento antes de solicitar o reenviar otro código.": "serverErrors.backupEmailCooldown",
  "Alcanzaste el límite de solicitudes para tu cuenta. Probá de nuevo más tarde.": "serverErrors.backupEmailUserLimit",
  "Ese correo recibió demasiados códigos recientemente. Probá de nuevo más tarde.": "serverErrors.backupEmailDestinationLimit",
  "Se alcanzó el límite de solicitudes desde esta conexión. Probá de nuevo más tarde.": "serverErrors.backupEmailIpLimit",
  "No se pudo enviar el código de verificación. Revisá la configuración SMTP e intentá más tarde.": "serverErrors.backupEmailSmtpUnavailable",
  "No hay un correo pendiente de verificación.": "serverErrors.backupEmailNoPending",
  "No hay un código válido pendiente. Solicitá uno nuevo.": "serverErrors.backupEmailNoChallenge",
  "El código venció. Solicitá uno nuevo.": "serverErrors.backupEmailExpired",
  "El código de verificación no es correcto.": "serverErrors.backupEmailCodeWrong",
  "Se agotaron los intentos. Solicitá un código nuevo.": "serverErrors.backupEmailAttempts",
  "Ese correo ahora coincide con un correo principal. Solicitá otro.": "serverErrors.backupEmailPrimaryConflict",
  "No hay un correo de respaldo para eliminar.": "serverErrors.backupEmailNoBackup",
  "Ese correo ya no está disponible. Probá con otra dirección.": "serverErrors.backupEmailUnavailable",
  "No se pudo actualizar el desafío. Probá de nuevo.": "serverErrors.backupEmailConflictChallenge",
  "El correo pendiente cambió. Actualizá el estado e intentá de nuevo.": "serverErrors.backupEmailChangedPending",
  "No se pudo eliminar el correo de respaldo. Actualizá la pantalla e intentá de nuevo.": "serverErrors.backupEmailConflictRemove",
  "No se pudo verificar ese correo porque dejó de estar disponible.": "serverErrors.backupEmailConflictVerify",
  "Ese email ya está configurado como correo de respaldo y no puede ser principal.": "serverErrors.backupEmailCannotBePrimary",
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
    const blockKind = String(response.headers?.["x-block-kind"] ?? response.data?.code ?? "");
    // Solo traducir como bloqueo de IP cuando backend lo identifica explícitamente.
    // Otros 429 (p. ej. verificación de correo) conservan su detalle específico.
    if (Number.isFinite(retryAfter) && retryAfter > 0 && ["login_lock", "flood_ban", "ip_banned"].includes(blockKind)) {
      const banned = blockKind === "flood_ban" || blockKind === "ip_banned";
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
