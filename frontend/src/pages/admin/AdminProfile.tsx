import { useState } from "react";
import { isAxiosError } from "axios";
import { useChangePassword, useMe } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import { getServerDetail } from "@/lib/errors";

const initial = { current: "", next: "", confirm: "" };

function getErrorMessage(error: unknown): string {
  if (isAxiosError(error) && !error.response) {
    return "No pudimos conectar con el servidor. Probá de nuevo.";
  }
  if (isAxiosError(error) && error.response?.status === 422) {
    return "La contraseña nueva tiene que tener entre 8 y 72 caracteres.";
  }
  return getServerDetail(error) ?? "No pudimos cambiar la contraseña. Probá de nuevo.";
}

export default function AdminProfile() {
  const { data: me } = useMe();
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
    if (form.next.length < 8) return setLocalError("La contraseña nueva tiene que tener al menos 8 caracteres.");
    if (form.next === form.current) return setLocalError("La contraseña nueva tiene que ser distinta de la actual.");
    if (form.next !== form.confirm) return setLocalError("Las contraseñas nuevas no coinciden.");

    changePassword.mutate(
      { current_password: form.current, new_password: form.next },
      {
        onSuccess: () => {
          setForm(initial);
          setDone(true);
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        {me && (
          <p className="mt-1 text-sm text-gray-500">
            {me.full_name ? `${me.full_name} · ` : ""}
            {me.email}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Cambiar contraseña</h2>
        <TextField label="Contraseña actual" name="current" type="password" value={form.current} onChange={handleChange} required autoComplete="current-password" />
        <TextField label="Contraseña nueva" name="next" type="password" value={form.next} onChange={handleChange} required autoComplete="new-password" hint="Mínimo 8 caracteres." />
        <TextField label="Repetí la contraseña nueva" name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" />

        {(localError || changePassword.isError) && (
          <p role="alert" className="text-sm text-red-600">
            {localError ?? getErrorMessage(changePassword.error)}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-green-700">
            ¡Listo! Cambiaste tu contraseña. Desde ahora usá la nueva para ingresar.
          </p>
        )}

        <button
          type="submit"
          disabled={changePassword.isPending}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {changePassword.isPending ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
