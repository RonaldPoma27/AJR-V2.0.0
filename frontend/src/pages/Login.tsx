import { useState } from "react";
import { isAxiosError } from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { loginRequest } from "@/api/auth";

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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await loginRequest(email.trim(), password);
      queryClient.clear(); // que no queden datos de otra sesión
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith("/admin") ? from : "/admin/pedidos", { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl font-bold text-gray-900">Acceso equipo</h1>
      <p className="mt-1 text-sm text-gray-500">Ingresá para ver pedidos y postulaciones.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="mt-1 w-full rounded-md border px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
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
    </div>
  );
}
