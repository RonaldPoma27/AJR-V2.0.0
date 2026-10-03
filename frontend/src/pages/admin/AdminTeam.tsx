import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { useMe } from "@/api/auth";
import { usePromoteTechnician, useRemoveTechnician, useTechnicians } from "@/api/team";
import { TextField } from "@/components/forms/Fields";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { getServerDetail } from "@/lib/errors";

/**
 * Equipo (TECHNICIAN = "Editor"). Todos los del panel ven la lista; solo el ADMIN puede
 * sumar o quitar técnicos.
 */
export default function AdminTeam() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";
  const { data, isLoading, isError, refetch } = useTechnicians();
  const promote = usePromoteTechnician();
  const remove = useRemoveTechnician();
  const [email, setEmail] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setAdded(null);
    promote.mutate(value, {
      onSuccess: (user) => {
        setEmail("");
        setAdded(user.full_name || user.email);
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Equipo</h1>
        <p className="text-sm text-fg-subtle">
          Los técnicos pueden ver y cambiar el estado de pedidos, postulaciones y chats, y editar el portfolio.
          Solo el administrador puede enviar a la papelera, restaurar y gestionar esta lista.
        </p>
      </div>

      {isAdmin ? (
        <form onSubmit={submit} className="rounded-lg border bg-surface p-5">
          <h2 className="font-semibold text-fg">Sumar un técnico</h2>
          <p className="mt-1 text-sm text-fg-subtle">La persona tiene que estar registrada en el sitio. Ingresá el email con el que se registró.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <TextField label="Email" name="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAdded(null); }} autoComplete="off" required />
            </div>
            <button type="submit" disabled={promote.isPending || !email.trim()} className="mb-0.5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
              <UserPlus className="h-4 w-4" aria-hidden />
              {promote.isPending ? "Agregando..." : "Dar rol de técnico"}
            </button>
          </div>
          {promote.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {getServerDetail(promote.error) ?? "No pudimos cambiar el rol. Probá de nuevo."}
            </p>
          )}
          {added && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">{added} ahora es técnico.</p>}
        </form>
      ) : (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-fg-muted">Estás viendo la lista en modo lectura: solo un administrador puede modificarla.</p>
      )}

      <section aria-labelledby="tech-list">
        <h2 id="tech-list" className="mb-2 font-semibold text-fg">Técnicos actuales{data ? ` (${data.length})` : ""}</h2>
        {isLoading && <p className="text-fg-subtle">Cargando…</p>}
        {isError && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            No pudimos cargar la lista. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button>
          </p>
        )}
        {remove.isError && (
          <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{getServerDetail(remove.error) ?? "No pudimos quitar el rol."}</p>
        )}
        {data && data.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-fg-subtle">Todavía no hay técnicos. {isAdmin ? "Sumá el primero con el formulario de arriba." : ""}</p>
        )}
        <ul className="divide-y rounded-lg border bg-surface">
          {data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{u.full_name || "Sin nombre cargado"}</p>
                <p className="truncate text-sm text-fg-subtle">{u.email}</p>
              </div>
              {isAdmin && (
                <ConfirmButton
                  label="Quitar rol"
                  question="¿Quitarle el rol de técnico?"
                  confirmLabel="Sí, quitar"
                  onConfirm={() => remove.mutate(u.id)}
                  disabled={remove.isPending}
                  icon={<UserMinus className="h-4 w-4" aria-hidden />}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
