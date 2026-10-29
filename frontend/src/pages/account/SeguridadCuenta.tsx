import { useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeft, CheckCircle2, Clock3, MailCheck, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useBackupEmailState,
  useDeleteBackupEmail,
  useRequestBackupEmail,
  useResendBackupEmail,
  useVerifyBackupEmail,
} from "@/api/backupEmail";
import { TextField } from "@/components/forms/Fields";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { getServerDetail } from "@/lib/errors";
import { dateLocale } from "@/i18n";

function securityError(error: unknown, t: (key: string) => string): string {
  if (isAxiosError(error) && !error.response) return t("myAccount.security.errors.connection");
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const detail = getServerDetail(error);
  if (detail) return detail;
  if (status === 422) return t("myAccount.security.errors.invalidFields");
  if (status === 409) return t("myAccount.security.errors.conflict");
  if (status === 429) return t("myAccount.security.errors.rateLimit");
  if (status === 503) return t("myAccount.security.errors.emailUnavailable");
  return t("myAccount.security.errors.generic");
}

function StatusPill({ kind, children }: { kind: "verified" | "pending" | "empty"; children: React.ReactNode }) {
  const classes = {
    verified: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    empty: "border-slate-400/25 bg-slate-400/10 text-slate-300",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${classes[kind]}`}>{children}</span>;
}

export default function SeguridadCuenta() {
  const { t } = useTranslation();
  const state = useBackupEmailState();
  const request = useRequestBackupEmail();
  const verify = useVerifyBackupEmail();
  const resend = useResendBackupEmail();
  const remove = useDeleteBackupEmail();
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backup = state.data;
  const pending = Boolean(backup?.pending_email);
  const verified = Boolean(backup?.email);
  const busy = request.isPending || verify.isPending || resend.isPending || remove.isPending;

  function clearMessages() {
    setFeedback(null);
    setError(null);
  }

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // evita dobles envíos incluso si el formulario se envía con Enter
    clearMessages();
    const target = emailInput.trim().toLowerCase();
    if (!target || !target.includes("@") || target.endsWith("@")) {
      setError(t("myAccount.security.errors.invalidEmail"));
      return;
    }
    if (!password) {
      setError(t("myAccount.security.errors.passwordRequired"));
      return;
    }
    request.mutate(
      { email: target, current_password: password },
      {
        onSuccess: () => {
          setEmailInput("");
          setPassword("");
          setCode("");
          setFeedback(t("myAccount.security.messages.requestSent"));
        },
        onError: (err) => setError(securityError(err, t)),
      },
    );
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    clearMessages();
    if (!/^\d{6}$/.test(code)) {
      setError(t("myAccount.security.errors.codeFormat"));
      return;
    }
    verify.mutate(
      { code },
      {
        onSuccess: () => {
          setCode("");
          setPassword("");
          setFeedback(t("myAccount.security.messages.verified"));
        },
        onError: (err) => setError(securityError(err, t)),
      },
    );
  }

  function handleResend() {
    if (busy) return;
    clearMessages();
    if (!password) {
      setError(t("myAccount.security.errors.passwordRequired"));
      return;
    }
    resend.mutate(
      { current_password: password },
      {
        onSuccess: () => {
          setPassword("");
          setCode("");
          setFeedback(t("myAccount.security.messages.resent"));
        },
        onError: (err) => setError(securityError(err, t)),
      },
    );
  }

  function handleDelete() {
    if (busy) return;
    clearMessages();
    if (!password) {
      setError(t("myAccount.security.errors.passwordRequired"));
      return;
    }
    remove.mutate(
      { current_password: password },
      {
        onSuccess: () => {
          setPassword("");
          setEmailInput("");
          setCode("");
          setFeedback(t("myAccount.security.messages.deleted"));
        },
        onError: (err) => setError(securityError(err, t)),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start gap-3">
        <Link to="/cuenta" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-fg-muted transition hover:border-cyan-300/40 hover:bg-white/10 hover:text-fg" aria-label={t("myAccount.security.backToAccount")}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden />
            <h1 className="text-2xl font-bold text-fg">{t("myAccount.security.title")}</h1>
          </div>
          <p className="mt-1 text-sm text-fg-subtle">{t("myAccount.security.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-4 text-sm text-fg-muted">
        <p>{t("myAccount.security.futureRecoveryNote")}</p>
      </div>

      {feedback && <p role="status" className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">{feedback}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

      {state.isPending ? (
        <div className="rounded-xl border border-white/10 bg-surface p-6 text-sm text-fg-subtle" role="status">{t("myAccount.security.loading")}</div>
      ) : state.isError ? (
        <div className="rounded-xl border border-white/10 bg-surface p-6">
          <p className="text-sm text-red-300">{securityError(state.error, t)}</p>
          <button type="button" onClick={() => state.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            <RefreshCw className="h-4 w-4" aria-hidden />{t("myAccount.security.retry")}
          </button>
        </div>
      ) : (
        <>
          <section className="space-y-4 rounded-xl border border-white/10 bg-surface p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-fg">{t("myAccount.security.statusTitle")}</h2>
              {verified ? (
                <StatusPill kind="verified"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{t("myAccount.security.status.verified")}</StatusPill>
              ) : pending ? (
                <StatusPill kind="pending"><Clock3 className="h-3.5 w-3.5" aria-hidden />{t("myAccount.security.status.pending")}</StatusPill>
              ) : (
                <StatusPill kind="empty"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t("myAccount.security.status.notConfigured")}</StatusPill>
              )}
            </div>

            {verified ? (
              <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-4">
                <div className="flex items-start gap-3">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{t("myAccount.security.verifiedEmail")}</p>
                    <p className="mt-1 break-all font-medium text-fg">{backup?.email}</p>
                    {backup?.verified_at && <p className="mt-1 text-xs text-fg-subtle">{t("myAccount.security.verifiedOn", { date: new Date(backup.verified_at).toLocaleString(dateLocale()) })}</p>}
                  </div>
                </div>
              </div>
            ) : !pending ? (
              <p className="text-sm text-fg-subtle">{t("myAccount.security.notConfiguredText")}</p>
            ) : null}

            {pending && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{t("myAccount.security.pendingEmail")}</p>
                    <p className="mt-1 break-all font-medium text-fg">{backup?.pending_email}</p>
                    <p className="mt-2 text-sm text-fg-muted">{verified ? t("myAccount.security.oldEmailRemainsActive") : t("myAccount.security.pendingExplanation")}</p>
                    {backup?.pending_expires_at && <p className="mt-1 text-xs text-fg-subtle">{t("myAccount.security.codeExpires", { date: new Date(backup.pending_expires_at).toLocaleString(dateLocale()) })}</p>}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-white/10 bg-surface p-5 shadow-xl shadow-black/10 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-fg">{pending ? t("myAccount.security.changePendingTitle") : verified ? t("myAccount.security.changeTitle") : t("myAccount.security.addTitle")}</h2>
              <p className="mt-1 text-sm text-fg-subtle">{t("myAccount.security.requestHelp")}</p>
            </div>
            <form onSubmit={handleRequest} className="space-y-4" noValidate>
              <TextField
                label={t("myAccount.security.emailLabel")}
                name="backup_email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                maxLength={255}
                autoComplete="email"
                placeholder={t("myAccount.security.emailPlaceholder")}
              />
              <TextField
                label={t("myAccount.security.currentPassword")}
                name="current_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                hint={t("myAccount.security.passwordHint")}
              />
              <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                <MailCheck className="h-4 w-4" aria-hidden />{request.isPending ? t("myAccount.security.sending") : t("myAccount.security.sendCode")}
              </button>
            </form>
          </section>

          {pending && (
            <section className="space-y-4 rounded-xl border border-white/10 bg-surface p-5 shadow-xl shadow-black/10 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-fg">{t("myAccount.security.verifyTitle")}</h2>
                <p className="mt-1 text-sm text-fg-subtle">{t("myAccount.security.verifyHelp")}</p>
              </div>
              <form onSubmit={handleVerify} className="space-y-4" noValidate>
                <TextField
                  label={t("myAccount.security.codeLabel")}
                  name="verification_code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  hint={t("myAccount.security.codeHint")}
                />
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={busy || code.length !== 6} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />{verify.isPending ? t("myAccount.security.verifying") : t("myAccount.security.verify")}
                  </button>
                  <button type="button" onClick={handleResend} disabled={busy || !password} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-fg transition duration-300 hover:border-cyan-300/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" title={!password ? t("myAccount.security.passwordNeededForResend") : undefined}>
                    <RefreshCw className="h-4 w-4" aria-hidden />{resend.isPending ? t("myAccount.security.resending") : t("myAccount.security.resend")}
                  </button>
                </div>
              </form>
            </section>
          )}

          {(verified || pending) && (
            <section className="rounded-xl border border-red-400/15 bg-red-950/10 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{t("myAccount.security.removeTitle")}</h2>
              <p className="mt-1 text-sm text-fg-subtle">{t("myAccount.security.removeHelp")}</p>
              <div className="mt-4">
                <ConfirmButton
                  label={t("myAccount.security.remove")}
                  question={t("myAccount.security.removeConfirm")}
                  confirmLabel={remove.isPending ? t("myAccount.security.removing") : t("myAccount.security.confirmRemove")}
                  disabled={busy || !password}
                  onConfirm={handleDelete}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  className="border-red-400/25 text-red-300 hover:border-red-300 hover:bg-red-400/10"
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
