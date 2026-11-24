import { useTranslation } from "react-i18next";
import { ShieldCheck, Mail } from "lucide-react";
import { BackupEmailState } from "@/api/backupEmail";
import { dateLocale } from "@/i18n";

export default function BackupEmailStatus({ state }: { state: BackupEmailState }) {
  const { t } = useTranslation();
  return <section className="rounded-xl border border-cyan-400/20 bg-surface p-5 space-y-3" aria-labelledby="backup-status">
    <div className="flex items-center gap-3">
      {state.email ? <ShieldCheck className="text-cyan-300" aria-hidden /> : <Mail className="text-fg-muted" aria-hidden />}
      <h2 id="backup-status" className="font-semibold text-fg">{t(`security.states.${state.status}`)}</h2>
    </div>
    {state.email && <p className="break-all text-fg">{state.email}</p>}
    {state.verified_at && <p className="text-sm text-fg-muted">{t("security.verifiedAt", { date: new Date(state.verified_at).toLocaleString(dateLocale()) })}</p>}
    {state.pending_email && <div className="rounded-lg bg-surface-2 p-3 space-y-2">
      <p className="break-all text-sm">{t("security.pendingAddress", { email: state.pending_email })}</p>
      {state.email && <p className="text-sm text-cyan-300">{t("security.previousActive")}</p>}
      {state.expires_at && <p className="text-sm text-fg-muted">{t("security.expiresAt", { date: new Date(state.expires_at).toLocaleString(dateLocale()) })}</p>}
      <p className="text-sm text-fg-muted">{t("security.attempts", { count: state.attempts_remaining ?? 0 })}</p>
      {state.challenge_expired && <p className="text-sm text-amber-300">{t("security.errors.backup_code_expired")}</p>}
    </div>}
    <p className="text-sm text-fg-muted">{t("security.futureRecovery")}</p>
  </section>;
}
