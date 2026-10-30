import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRestoreTrashItem, useTrash, type TrashItem } from "@/api/trash";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { formatRemaining, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

const KIND_LABEL_KEY = { order: "adminTrash.kindOrder", application: "adminTrash.kindApplication" } as const;
const URGENT_SECONDS = 3 * 86_400;

function Row({ item, now, loadedAt }: { item: TrashItem; now: number; loadedAt: number }) {
  const { t } = useTranslation();
  const restore = useRestoreTrashItem();
  // seconds_left lo calcula el servidor (no depende del reloj del cliente); entre recargas
  // lo descontamos con el tiempo transcurrido para que la cuenta regresiva siga viva.
  const left = Math.max(0, item.seconds_left - Math.floor(Math.max(0, now - loadedAt) / 1000));
  const urgent = left <= URGENT_SECONDS;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-fg">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">{t(KIND_LABEL_KEY[item.kind])}</span>
          <span className="truncate">{item.title}</span>
        </p>
        <p className="text-sm text-fg-subtle">{item.subtitle}</p>
        <p className="mt-1 text-sm text-fg-subtle">{t("adminTrash.sentOn", { date: formatDateTime(item.deleted_at) })}</p>
        <p className={cn("text-sm font-medium", urgent ? "text-red-600 dark:text-red-400" : "text-fg-muted")}>
          {t("adminTrash.deletesIn", { time: formatRemaining(left) })}
        </p>
        {restore.isError && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{getServerDetail(restore.error) ?? t("adminTrash.restoreError")}</p>}
      </div>
      <button
        type="button"
        disabled={restore.isPending}
        onClick={() => restore.mutate({ kind: item.kind, id: item.id })}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-fg-muted hover:border-brand hover:text-accent disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {restore.isPending ? t("adminTrash.restoring") : t("adminTrash.restore")}
      </button>
    </li>
  );
}

/** Solo ADMIN: lo que se envió a la papelera y cuánto falta para que se elimine de verdad. */
export default function AdminTrash() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useTrash();
  const now = useNow(30_000);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("adminTrash.title")}</h1>
        <p className="text-sm text-fg-subtle">
          {t("adminTrash.subtitle", { days: data?.retention_days ?? 30 })}
        </p>
      </div>

      {isLoading && <p className="text-fg-subtle">{t("adminCommon.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("adminTrash.loadError")} <button onClick={() => refetch()} className="font-medium underline">{t("adminCommon.retry")}</button>
        </p>
      )}
      {data && data.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-10 text-center text-fg-subtle">{t("adminTrash.empty")}</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y rounded-lg border bg-surface">
          {data.items.map((item) => (
            <Row key={`${item.kind}-${item.id}`} item={item} now={now} loadedAt={dataUpdatedAt} />
          ))}
        </ul>
      )}
    </div>
  );
}
