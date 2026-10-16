import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useChangeEmail, useChangePassword, useMe, useUpdateProfile } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import PasswordChecklist from "@/components/forms/PasswordChecklist";
import { getServerDetail } from "@/lib/errors";
import { getPasswordError as getPasswordErrorHelper } from "@/lib/password";

const initial = { current: "", next: "", confirm: "" };

function getPasswordError(error: unknown): string {
  if (isAxiosError(error) && !error.response) return i18n.t("myAccount.errors.connection");
  if (isAxiosError(error) && error.response?.status === 422) return i18n.t("myAccount.errors.passwordWeak");
  return getServerDetail(error) ?? i18n.t("myAccount.errors.passwordFailed");
}

function ProfileForm() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setFirst(me.first_name ?? "");
      setLast(me.last_name ?? "");
    }
  }, [me]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setLocalError(null);
    if (!first.trim() || !last.trim()) return setLocalError(t("myAccount.errors.nameRequired"));
    update.mutate({ first_name: first.trim(), last_name: last.trim() }, { onSuccess: () => setSaved(true) });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">{t("myAccount.profile.title")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("myAccount.profile.firstName")} name="first_name" value={first} onChange={(e) => { setFirst(e.target.value); setSaved(false); }} required maxLength={75} autoComplete="given-name" />
        <TextField label={t("myAccount.profile.lastName")} name="last_name" value={last} onChange={(e) => { setLast(e.target.value); setSaved(false); }} required maxLength={75} autoComplete="family-name" />
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-fg-subtle">{t("myAccount.profile.email")}</dt>
        <dd className="break-all text-fg">{me?.email}</dd>
        <dt className="text-fg-subtle">{t("myAccount.profile.role")}</dt>
        <dd className="text-fg">{me ? t(`myAccount.roles.${me.role}`) : ""}</dd>
      </dl>
      {(localError || update.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {localError ?? getServerDetail(update.error) ?? t("myAccount.errors.profileFailed")}
        </p>
      )}
      {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("myAccount.profile.saved")}</p>}
      <button type="submit" disabled={update.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {update.isPending ? t("myAccount.profile.saving") : t("myAccount.profile.save")}
      </button>
    </form>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getEmailError(error: unknown): string {
  if (isAxiosError(error) && !error.response) return i18n.t("myAccount.errors.connection");
  if (isAxiosError(error) && error.response?.status === 422) return i18n.t("myAccount.errors.emailsInvalid");
  return getServerDetail(error) ?? i18n.t("myAccount.errors.emailFailed");
}

function EmailForm() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const changeEmail = useChangeEmail();
  const [form, setForm] = useState({ current: "", next: "", password: "" });
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setDone(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setDone(false);
    const current = form.current.trim().toLowerCase();
    const next = form.next.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) return setLocalError(t("myAccount.errors.newEmailInvalid"));
    if (current !== (me?.email ?? "").toLowerCase()) return setLocalError(t("myAccount.errors.currentEmailMismatch"));
    if (next === current) return setLocalError(t("myAccount.errors.sameEmail"));
    changeEmail.mutate(
      { current_email: current, new_email: next, current_password: form.password },
      { onSuccess: () => { setForm({ current: "", next: "", password: "" }); setDone(true); } }
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">{t("myAccount.email.title")}</h2>
      <TextField label={t("myAccount.email.current")} name="current" type="email" value={form.current} onChange={handleChange} required autoComplete="email" />
      <TextField label={t("myAccount.email.new")} name="next" type="email" value={form.next} onChange={handleChange} required maxLength={255} autoComplete="off" />
      <TextField label={t("myAccount.email.password")} name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="current-password" hint={t("myAccount.email.passwordHint")} />
      {(localError || changeEmail.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{localError ?? getEmailError(changeEmail.error)}</p>
      )}
      {done && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("myAccount.email.done")}</p>}
      <button type="submit" disabled={changeEmail.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {changeEmail.isPending ? t("myAccount.email.saving") : t("myAccount.email.submit")}
      </button>
    </form>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const changePassword = useChangePassword();
  const [form, setForm] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setDone(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setDone(false);
    const strengthError = getPasswordErrorHelper(form.next);
    if (strengthError) return setLocalError(t("myAccount.errors.newPasswordPrefix", { error: `${strengthError.charAt(0).toLowerCase()}${strengthError.slice(1)}` }));
    if (form.next === form.current) return setLocalError(t("myAccount.errors.samePassword"));
    if (form.next !== form.confirm) return setLocalError(t("myAccount.errors.passwordMismatch"));
    changePassword.mutate(
      { current_password: form.current, new_password: form.next },
      { onSuccess: () => { setForm(initial); setDone(true); } }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">{t("myAccount.password.title")}</h2>
      <TextField label={t("myAccount.password.current")} name="current" type="password" value={form.current} onChange={handleChange} required autoComplete="current-password" />
      <TextField label={t("myAccount.password.new")} name="next" type="password" value={form.next} onChange={handleChange} required autoComplete="new-password" />
      <PasswordChecklist value={form.next} />
      <TextField label={t("myAccount.password.confirm")} name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" />
      {(localError || changePassword.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{localError ?? getPasswordError(changePassword.error)}</p>
      )}
      {done && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("myAccount.password.done")}</p>}
      <button type="submit" disabled={changePassword.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {changePassword.isPending ? t("myAccount.password.saving") : t("myAccount.password.submit")}
      </button>
    </form>
  );
}

export default function MiCuenta() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("myAccount.title")}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{me?.full_name ? `${me.full_name} · ` : ""}{me?.email}</p>
      </div>
      <ProfileForm />
      <EmailForm />
      <PasswordForm />
    </div>
  );
}
