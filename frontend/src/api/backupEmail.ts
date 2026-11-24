import { isAxiosError } from "axios";
import { apiClient } from "./client";

export interface BackupEmailState {
  status: "not_configured" | "pending" | "verified";
  email: string | null;
  verified_at: string | null;
  pending_email: string | null;
  expires_at: string | null;
  resend_available_at: string | null;
  attempts_remaining: number | null;
  challenge_expired: boolean;
  recovery_available: boolean;
  notification_sent: boolean | null;
}
export type BackupAction = "request" | "verify" | "resend" | "remove";
type Language = "es" | "en";
const path = "/security/backup-email";
export async function getBackupEmail(): Promise<BackupEmailState> {
  return (await apiClient.get<BackupEmailState>(path)).data;
}
export async function requestBackupEmail(email: string, current_password: string, language: Language) {
  return (await apiClient.post<BackupEmailState>(`${path}/request`, { email, current_password, language })).data;
}
export async function verifyBackupEmail(code: string, language: Language) {
  return (await apiClient.post<BackupEmailState>(`${path}/verify`, { code, language })).data;
}
export async function resendBackupEmail(current_password: string, language: Language) {
  return (await apiClient.post<BackupEmailState>(`${path}/resend`, { current_password, language })).data;
}
export async function removeBackupEmail(current_password: string, language: Language) {
  return (await apiClient.delete<BackupEmailState>(path, { data: { current_password, language } })).data;
}
export function backupErrorKey(error: unknown): string {
  const codes = ["backup_address_unavailable", "backup_password_incorrect", "backup_no_challenge",
    "backup_cooldown", "backup_rate_limited", "backup_mail_unavailable", "backup_code_expired",
    "backup_attempts_exhausted", "backup_code_invalid", "backup_invalid_input"];
  if (isAxiosError(error)) {
    if (!error.response) return "security.errors.connection";
    const detail = error.response.data?.detail;
    if (typeof detail === "string" && codes.includes(detail)) return `security.errors.${detail}`;
    if (error.response.status === 429) return "security.errors.backup_rate_limited";
  }
  return "security.errors.generic";
}
