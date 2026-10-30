import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMe } from "@/api/auth";
import { BackupAction, backupErrorKey, getBackupEmail, removeBackupEmail, requestBackupEmail, resendBackupEmail, verifyBackupEmail } from "@/api/backupEmail";
import BackupEmailStatus from "@/components/security/BackupEmailStatus";
import BackupEmailForms from "@/components/security/BackupEmailForms";

export default function Seguridad() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const key = ["backup-email", me?.id];
  const query = useQuery({ queryKey: key, queryFn: getBackupEmail, enabled: Boolean(me), retry: false });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BackupAction | null>(null);
  const [noticeFailed, setNoticeFailed] = useState(false);
  async function act(action: BackupAction, values: { email?: string; password?: string; code?: string }) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(null); setSuccess(null); setNoticeFailed(false);
    const language = i18n.resolvedLanguage === "en" ? "en" : "es";
    try {
      // Stop a stale GET from overwriting the result of a mutation.
      await queryClient.cancelQueries({ queryKey: key });
      const result = action === "request" ? await requestBackupEmail(values.email!, values.password!, language)
        : action === "resend" ? await resendBackupEmail(values.password!, language)
        : action === "verify" ? await verifyBackupEmail(values.code!, language)
        : await removeBackupEmail(values.password!, language);
      queryClient.setQueryData(key, result);
      setSuccess(action); setNoticeFailed(result.notification_sent === false);
      return true;
    } catch (err) {
      setError(backupErrorKey(err));
      // Preserve form values; refresh actual persisted state after ambiguous network errors.
      await query.refetch();
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto w-full space-y-6 px-4 py-6 md:px-8" style={{ maxWidth: "48rem" }}>
    <Link to="/cuenta" className="text-sm text-cyan-300 hover:underline">{t("security.back")}</Link>
    <header className="space-y-2"><h1 className="text-3xl font-semibold">{t("security.title")}</h1><p className="text-fg-muted">{t("security.intro")}</p></header>
    {(query.isPending || !me) && <p role="status">{t("security.loading")}</p>}
    {(error || query.isError) && <div role="alert" className="rounded-lg border border-red-400/30 p-4 text-red-300"><p>{t(error ?? backupErrorKey(query.error))}</p><button className="mt-2 underline" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>{t("security.refresh")}</button></div>}
    {success && <p role="status" className="rounded-lg border border-cyan-400/30 p-4 text-cyan-300">{t(`security.success.${success}`)}</p>}
    {noticeFailed && <p role="alert" className="text-amber-300">{t("security.noticeFailed")}</p>}
    {query.data && <><BackupEmailStatus state={query.data} /><BackupEmailForms state={query.data} busy={busy} onAction={act} /></>}
  </div>;
}
