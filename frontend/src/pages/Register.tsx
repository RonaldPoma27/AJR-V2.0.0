import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchMe, getToken, registerRequest } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import PasswordChecklist from "@/components/forms/PasswordChecklist";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import i18n from "@/i18n";
import { getServerDetail } from "@/lib/errors";
import { getPasswordError } from "@/lib/password";
import { landingFor } from "./Login";

const initial = { first_name: "", last_name: "", email: "", password: "", confirm: "" };
type Errors = Partial<Record<keyof typeof initial, string>>;

function validate(f: typeof initial): Errors {
  const e: Errors = {};
  if (!f.first_name.trim()) e.first_name = i18n.t("auth.errors.firstNameRequired");
  if (!f.last_name.trim()) e.last_name = i18n.t("auth.errors.lastNameRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = i18n.t("auth.errors.emailInvalid");
  const passwordError = getPasswordError(f.password);
  if (passwordError) e.password = passwordError;
  if (f.confirm !== f.password) e.confirm = i18n.t("auth.errors.passwordMismatch");
  return e;
}

function getRegisterError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return i18n.t("serverErrors.connection");
    if (error.response.status === 422) return i18n.t("auth.errors.invalidData");
    return getServerDetail(error) ?? i18n.t("auth.errors.registerFailed", { status: error.response.status });
  }
  return i18n.t("auth.errors.unexpected");
}

/** Registro público: siempre crea una cuenta de cliente (rol USER). */
export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  if (getToken() && !loading) return <Navigate to={from ?? "/cuenta"} replace />;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);
    if (submitted) setErrors(validate(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (turnstileEnabled && !token) {
      setServerError(t("turnstile.required"));
      return;
    }

    setServerError(null);
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      await registerRequest({
        email,
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        turnstile_token: token ?? undefined,
      });
      // registerRequest ya deja la sesión iniciada (guarda el token que devuelve el backend).
      queryClient.clear();
      const me = await fetchMe();
      queryClient.setQueryData(["me"], me);
      navigate(landingFor(me.role, from), { replace: true });
    } catch (err) {
      setServerError(getRegisterError(err));
      setLoading(false);
      turnstileRef.current?.reset(); // el token de Turnstile es de un solo uso
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 sm:py-20">
      <h1 className="text-2xl font-bold text-fg">{t("auth.register.title")}</h1>
      <p className="mt-1 text-sm text-fg-subtle">{t("auth.register.subtitle")}</p>
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("auth.fields.firstName")} name="first_name" value={form.first_name} onChange={handleChange} required maxLength={75} autoComplete="given-name" error={errors.first_name} />
          <TextField label={t("auth.fields.lastName")} name="last_name" value={form.last_name} onChange={handleChange} required maxLength={75} autoComplete="family-name" error={errors.last_name} />
        </div>
        <TextField label={t("auth.fields.email")} name="email" type="email" value={form.email} onChange={handleChange} required maxLength={255} autoComplete="email" error={errors.email} />
        <TextField label={t("auth.fields.password")} name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="new-password" error={errors.password} />
        <PasswordChecklist value={form.password} />
        <TextField label={t("auth.fields.confirmPassword")} name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" error={errors.confirm} />
        <Turnstile ref={turnstileRef} onToken={setToken} />
        {serverError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {serverError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || (turnstileEnabled && !token)}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-subtle">
        {t("auth.register.haveAccount")}{" "}
        <Link to="/login" state={{ from }} className="font-medium text-accent hover:underline">
          {t("auth.register.loginLink")}
        </Link>
      </p>
    </div>
  );
}
