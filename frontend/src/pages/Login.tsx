import { useState } from "react";
import { isAxiosError } from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, getToken, isStaff, loginRequest, type UserRole } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response || error.response.status >= 500) {
      return "No pudimos conectar con el servidor. Probá de nuevo en unos minutos.";
    }
    if (error.response.status === 401) {
      return "Email o contraseña incorrectos.";
    }
    if (error.response.status === 429) {
      return "Demasiados intentos. Esperá un momento y probá de nuevo.";
    }
    return `No pudimos iniciar sesión (código ${error.response.status}).`;
  }
  return "Ocurrió un error inesperado. Probá de nuevo.";
}

/** A dónde mandar a la persona después de entrar: a donde iba, o a su pantalla de inicio. */
export function landingFor(role: UserRole, from?: string): string {
  const safe = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;
  if (safe && !(safe.startsWith("/admin") && !isStaff(role))) return safe;
  return isStaff(role) ? "/admin/pedidos" : "/cuenta";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (getToken() && !loading) return <Navigate to={from ?? "/cuenta"} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await loginRequest(email.trim(), password);
      queryClient.clear(); // que no queden datos de otra sesión
      const me = await fetchMe();
      queryClient.setQueryData(["me"], me);
      navigate(landingFor(me.role, from), { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 sm:py-24">
      <h1 className="text-2xl font-bold text-fg">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-fg-subtle">Ingresá para seguir tus pedidos y escribirnos por soporte.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <TextField label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <TextField label="Contraseña" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-subtle">
        ¿No tenés cuenta?{" "}
        <Link to="/registro" state={{ from }} className="font-medium text-accent hover:underline">
          Registrate
        </Link>
      </p>
    </div>
  );
}
