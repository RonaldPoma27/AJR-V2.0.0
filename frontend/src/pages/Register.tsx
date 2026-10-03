import { useState } from "react";
import { isAxiosError } from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, getToken, loginRequest, registerRequest } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import PasswordChecklist from "@/components/forms/PasswordChecklist";
import { getServerDetail } from "@/lib/errors";
import { getPasswordError } from "@/lib/password";
import { landingFor } from "./Login";

const initial = { first_name: "", last_name: "", email: "", password: "", confirm: "" };
type Errors = Partial<Record<keyof typeof initial, string>>;

function validate(f: typeof initial): Errors {
  const e: Errors = {};
  if (!f.first_name.trim()) e.first_name = "Escribí tu nombre.";
  if (!f.last_name.trim()) e.last_name = "Escribí tu apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Revisá el email: parece que tiene un error.";
  const passwordError = getPasswordError(f.password);
  if (passwordError) e.password = passwordError;
  if (f.confirm !== f.password) e.confirm = "Las contraseñas no coinciden.";
  return e;
}

function getRegisterError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return "No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.";
    if (error.response.status === 422) return "Revisá los datos: alguno no es válido.";
    return getServerDetail(error) ?? `No pudimos crear tu cuenta (código ${error.response.status}).`;
  }
  return "Ocurrió un error inesperado. Probá de nuevo.";
}

/** Registro público: siempre crea una cuenta de cliente (rol USER). */
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    setServerError(null);
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      await registerRequest({ email, password: form.password, first_name: form.first_name.trim(), last_name: form.last_name.trim() });
      await loginRequest(email, form.password); // queda con la sesión iniciada
      queryClient.clear();
      const me = await fetchMe();
      queryClient.setQueryData(["me"], me);
      navigate(landingFor(me.role, from), { replace: true });
    } catch (err) {
      setServerError(getRegisterError(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16 sm:py-20">
      <h1 className="text-2xl font-bold text-fg">Crear cuenta</h1>
      <p className="mt-1 text-sm text-fg-subtle">Con tu cuenta podés pedir proyectos, seguir su avance y escribirnos por soporte.</p>
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre" name="first_name" value={form.first_name} onChange={handleChange} required maxLength={75} autoComplete="given-name" error={errors.first_name} />
          <TextField label="Apellido" name="last_name" value={form.last_name} onChange={handleChange} required maxLength={75} autoComplete="family-name" error={errors.last_name} />
        </div>
        <TextField label="Email" name="email" type="email" value={form.email} onChange={handleChange} required maxLength={255} autoComplete="email" error={errors.email} />
        <TextField label="Contraseña" name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="new-password" error={errors.password} />
        <PasswordChecklist value={form.password} />
        <TextField label="Repetí la contraseña" name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" error={errors.confirm} />
        {serverError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {serverError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-subtle">
        ¿Ya tenés cuenta?{" "}
        <Link to="/login" state={{ from }} className="font-medium text-accent hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
