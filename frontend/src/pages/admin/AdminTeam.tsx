import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        <h1 className="text-2xl font-bold text-fg">{t("adminTeam.title")}</h1>
        <p className="text-sm text-fg-subtle">
          {t("adminTeam.subtitle1")}
          {t("adminTeam.subtitle2")}
        </p>
      </div>

      {isAdmin ? (
        <form onSubmit={submit} className="rounded-lg border bg-surface p-5">
          <h2 className="font-semibold text-fg">{t("adminTeam.addTitle")}</h2>
          <p className="mt-1 text-sm text-fg-subtle">{t("adminTeam.addHint")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <TextField label={t("adminCommon.email")} name="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAdded(null); }} autoComplete="off" required />
            </div>
            <button type="submit" disabled={promote.isPending || !email.trim()} className="mb-0.5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
              <UserPlus className="h-4 w-4" aria-hidden />
              {promote.isPending ? t("adminTeam.adding") : t("adminTeam.addButton")}
            </button>
          </div>
          {promote.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {getServerDetail(promote.error) ?? t("adminTeam.promoteError")}
            </p>
          )}
          {added && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">{t("adminTeam.added", { name: added })}</p>}
        </form>
      ) : (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-fg-muted">{t("adminTeam.readOnly")}</p>
      )}

      <section aria-labelledby="tech-list">
        <h2 id="tech-list" className="mb-2 font-semibold text-fg">{t("adminTeam.current")}{data ? ` (${data.length})` : ""}</h2>
        {isLoading && <p className="text-fg-subtle">{t("adminCommon.loading")}</p>}
        {isError && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            {t("adminTeam.loadError")} <button onClick={() => refetch()} className="font-medium underline">{t("adminCommon.retry")}</button>
          </p>
        )}
        {remove.isError && (
          <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{getServerDetail(remove.error) ?? t("adminTeam.removeError")}</p>
        )}
        {data && data.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-fg-subtle">{t("adminTeam.empty")} {isAdmin ? t("adminTeam.emptyAdminHint") : ""}</p>
        )}
        <ul className="divide-y rounded-lg border bg-surface">
          {data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{u.full_name || t("adminTeam.noName")}</p>
                <p className="truncate text-sm text-fg-subtle">{u.email}</p>
              </div>
              {isAdmin && (
                <ConfirmButton
                  label={t("adminTeam.remove")}
                  question={t("adminTeam.removeQuestion")}
                  confirmLabel={t("adminTeam.removeConfirm")}
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
