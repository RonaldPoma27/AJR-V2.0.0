import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackupAction, BackupEmailState } from "@/api/backupEmail";

const button = "rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50";
const input = "mt-1 block w-full rounded-lg border bg-surface px-3 py-2.5 text-fg focus:outline focus:outline-2 focus:outline-cyan-300";
interface Props {
  state: BackupEmailState;
  busy: boolean;
  onAction: (action: BackupAction, values: { email?: string; password?: string; code?: string }) => Promise<boolean>;
}
export default function BackupEmailForms({ state, busy, onAction }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const wait = state.resend_available_at ? Math.max(0, Math.ceil((new Date(state.resend_available_at).getTime() - now) / 1000)) : 0;
  async function act(action: BackupAction) {
    if (busy) return;
    if (await onAction(action, { email, password, code })) {
      setPassword(""); setCode(""); setConfirmed(false);
      if (action === "request" || action === "remove") setEmail("");
    }
  }
  return <fieldset disabled={busy} className="space-y-5 min-w-0" aria-busy={busy}>
    <legend className="sr-only">{t("security.manage")}</legend>
    <section className="rounded-xl border bg-surface p-5 space-y-4">
      <h2 className="font-semibold">{t("security.manage")}</h2>
      <label className="block text-sm text-fg-muted" htmlFor="backup-password">{t("security.password")}
        <input id="backup-password" className={input} type="password" autoComplete="current-password" maxLength={72} value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <p className="text-xs text-fg-muted">{t("security.passwordHint")}</p>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act("request"); }}>
        <label className="block text-sm text-fg-muted" htmlFor="backup-address">{t("security.email")}
          <input id="backup-address" className={input} type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <button className={button} disabled={!password || !email || wait > 0} type="submit">{t(state.email ? "security.change" : "security.add")}</button>
      </form>
      {state.pending_email && <button type="button" className={button} disabled={!password || wait > 0} onClick={() => void act("resend")}>{t("security.resend")}</button>}
      {wait > 0 && <p className="text-sm text-fg-muted">{t("security.wait", { seconds: wait })}</p>}
    </section>
    {state.pending_email && <form className="rounded-xl border bg-surface p-5 space-y-4" onSubmit={e => { e.preventDefault(); void act("verify"); }}>
      <h2 className="font-semibold">{t("security.verifyTitle")}</h2>
      <label className="block text-sm text-fg-muted" htmlFor="backup-code">{t("security.code")}
        <input id="backup-code" className={input} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
      </label>
      <button className={button} type="submit" disabled={code.length !== 6 || state.attempts_remaining === 0 || (state.expires_at !== null && new Date(state.expires_at).getTime() <= now)}>{t("security.verify")}</button>
    </form>}
    {(state.email || state.pending_email) && <section className="rounded-xl border border-red-400/25 bg-surface p-5 space-y-4">
      <h2 className="font-semibold">{t("security.removeTitle")}</h2>
      <p className="text-sm text-fg-muted">{t("security.removeWarning")}</p>
      <label className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t("security.confirmRemove")}</label>
      <button type="button" className={`${button} !bg-red-700`} disabled={!confirmed || !password} onClick={() => void act("remove")}>{t("security.remove")}</button>
    </section>}
    {busy && <p role="status" className="text-sm text-cyan-300">{t("security.saving")}</p>}
  </fieldset>;
}
