import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchMe, getToken, isStaff, loginRequest, type UserRole } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import i18n from "@/i18n";
import { getServerDetail } from "@/lib/errors";

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response || error.response.status >= 500) {
      return i18n.t("auth.errors.server");
    }
    if (error.response.status === 401) {
      return i18n.t("auth.errors.badCredentials");
    }
    if (error.response.status === 429) {
      // Bloqueo de IP (5 contraseñas incorrectas): el mensaje trae cuánto falta.
      return getServerDetail(error) ?? i18n.t("auth.errors.tooMany");
    }
    if (error.response.status === 400 || error.response.status === 503) {
      return getServerDetail(error) ?? i18n.t("auth.errors.loginFailed", { status: error.response.status });
    }
    return i18n.t("auth.errors.loginFailed", { status: error.response.status });
  }
  return i18n.t("auth.errors.unexpected");
}

/** A dónde mandar a la persona después de entrar: a donde iba, o a su pantalla de inicio. */
export function landingFor(role: UserRole, from?: string): string {
  const safe = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;
  if (safe && !(safe.startsWith("/admin") && !isStaff(role))) return safe;
  return isStaff(role) ? "/admin/pedidos" : "/cuenta";
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  if (getToken() && !loading) return <Navigate to={from ?? "/cuenta"} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (turnstileEnabled && !token) {
      setError(t("turnstile.required"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginRequest(email.trim(), password, token);
      queryClient.clear(); // que no queden datos de otra sesión
      const me = await fetchMe();
      queryClient.setQueryData(["me"], me);
      navigate(landingFor(me.role, from), { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setLoading(false);
      turnstileRef.current?.reset(); // el token de Turnstile es de un solo uso
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 sm:py-24">
      <h1 className="text-2xl font-bold text-fg">{t("auth.login.title")}</h1>
      <p className="mt-1 text-sm text-fg-subtle">{t("auth.login.subtitle")}</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <TextField label={t("auth.fields.email")} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <TextField label={t("auth.fields.password")} name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <Turnstile ref={turnstileRef} onToken={setToken} />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || (turnstileEnabled && !token)}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-subtle">
        {t("auth.login.noAccount")}{" "}
        <Link to="/registro" state={{ from }} className="font-medium text-accent hover:underline">
          {t("auth.login.registerLink")}
        </Link>
      </p>
    </div>
  );
}
