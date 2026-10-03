import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useChangeEmail, useChangePassword, useMe, useUpdateProfile } from "@/api/auth";
import { TextField } from "@/components/forms/Fields";
import PasswordChecklist from "@/components/forms/PasswordChecklist";
import { getServerDetail } from "@/lib/errors";
import { getPasswordError as getPasswordErrorHelper } from "@/lib/password";

const initial = { current: "", next: "", confirm: "" };
const ROLE_LABEL = { USER: "Cliente", TECHNICIAN: "Técnico (editor)", ADMIN: "Administrador" } as const;

function getPasswordError(error: unknown): string {
  if (isAxiosError(error) && !error.response) return "No pudimos conectar con el servidor. Probá de nuevo.";
  if (isAxiosError(error) && error.response?.status === 422) return "La contraseña nueva no cumple los requisitos: 8 caracteres o más, una mayúscula, un número y un carácter especial.";
  return getServerDetail(error) ?? "No pudimos cambiar la contraseña. Probá de nuevo.";
}

function ProfileForm() {
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
    if (!first.trim() || !last.trim()) return setLocalError("Completá tu nombre y tu apellido.");
    update.mutate({ first_name: first.trim(), last_name: last.trim() }, { onSuccess: () => setSaved(true) });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">Mis datos</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="first_name" value={first} onChange={(e) => { setFirst(e.target.value); setSaved(false); }} required maxLength={75} autoComplete="given-name" />
        <TextField label="Apellido" name="last_name" value={last} onChange={(e) => { setLast(e.target.value); setSaved(false); }} required maxLength={75} autoComplete="family-name" />
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-fg-subtle">Email</dt>
        <dd className="break-all text-fg">{me?.email}</dd>
        <dt className="text-fg-subtle">Rol</dt>
        <dd className="text-fg">{me ? ROLE_LABEL[me.role] : ""}</dd>
      </dl>
      {(localError || update.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {localError ?? getServerDetail(update.error) ?? "No pudimos guardar tus datos. Probá de nuevo."}
        </p>
      )}
      {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">Datos guardados.</p>}
      <button type="submit" disabled={update.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {update.isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getEmailError(error: unknown): string {
  if (isAxiosError(error) && !error.response) return "No pudimos conectar con el servidor. Probá de nuevo.";
  if (isAxiosError(error) && error.response?.status === 422) return "Revisá los emails: alguno no es válido.";
  return getServerDetail(error) ?? "No pudimos cambiar el email. Probá de nuevo.";
}

function EmailForm() {
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
    if (!EMAIL_RE.test(next)) return setLocalError("Revisá el email nuevo: parece que tiene un error.");
    if (current !== (me?.email ?? "").toLowerCase()) return setLocalError("El email actual no coincide con el de tu cuenta.");
    if (next === current) return setLocalError("El email nuevo tiene que ser distinto del actual.");
    changeEmail.mutate(
      { current_email: current, new_email: next, current_password: form.password },
      { onSuccess: () => { setForm({ current: "", next: "", password: "" }); setDone(true); } }
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">Cambiar email</h2>
      <TextField label="Email actual" name="current" type="email" value={form.current} onChange={handleChange} required autoComplete="email" />
      <TextField label="Email nuevo" name="next" type="email" value={form.next} onChange={handleChange} required maxLength={255} autoComplete="off" />
      <TextField label="Contraseña actual" name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="current-password" hint="La pedimos para confirmar que sos vos." />
      {(localError || changeEmail.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{localError ?? getEmailError(changeEmail.error)}</p>
      )}
      {done && <p role="status" className="text-sm text-green-700 dark:text-green-400">¡Listo! Cambiaste tu email. Desde ahora usá el nuevo para ingresar.</p>}
      <button type="submit" disabled={changeEmail.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {changeEmail.isPending ? "Guardando..." : "Cambiar email"}
      </button>
    </form>
  );
}

function PasswordForm() {
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
    const strengthError = getPasswordError(form.next);
    if (strengthError) return setLocalError(`La contraseña nueva: ${strengthError.charAt(0).toLowerCase()}${strengthError.slice(1)}`);
    if (form.next === form.current) return setLocalError("La contraseña nueva tiene que ser distinta de la actual.");
    if (form.next !== form.confirm) return setLocalError("Las contraseñas nuevas no coinciden.");
    changePassword.mutate(
      { current_password: form.current, new_password: form.next },
      { onSuccess: () => { setForm(initial); setDone(true); } }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">Cambiar contraseña</h2>
      <TextField label="Contraseña actual" name="current" type="password" value={form.current} onChange={handleChange} required autoComplete="current-password" />
      <TextField label="Contraseña nueva" name="next" type="password" value={form.next} onChange={handleChange} required autoComplete="new-password" />
      <PasswordChecklist value={form.next} />
      <TextField label="Repetí la contraseña nueva" name="confirm" type="password" value={form.confirm} onChange={handleChange} required autoComplete="new-password" />
      {(localError || changePassword.isError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{localError ?? getPasswordError(changePassword.error)}</p>
      )}
      {done && <p role="status" className="text-sm text-green-700 dark:text-green-400">¡Listo! Cambiaste tu contraseña. Desde ahora usá la nueva para ingresar.</p>}
      <button type="submit" disabled={changePassword.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {changePassword.isPending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

export default function MiCuenta() {
  const { data: me } = useMe();
  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Mi cuenta</h1>
        <p className="mt-1 text-sm text-fg-subtle">{me?.full_name ? `${me.full_name} · ` : ""}{me?.email}</p>
      </div>
      <ProfileForm />
      <EmailForm />
      <PasswordForm />
    </div>
  );
}
