import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMySupportTickets } from "@/api/support";
import { SUPPORT_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

/** "Historial de chats": los chats del cliente listados por título. */
export default function ChatHistory({
  selectedId,
  onSelect,
  onNew,
}: {
  selectedId?: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useMySupportTickets();
  const now = useNow();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("chat.newChat")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {isLoading && <p className="text-sm text-fg-subtle">{t("chat.history.loading")}</p>}
        {isError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t("chat.history.loadError")}{" "}
            <button onClick={() => refetch()} className="font-medium underline">{t("chat.history.retry")}</button>
          </p>
        )}
        {data && data.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-fg-subtle">
            {t("chat.history.empty")}
          </p>
        )}
        {data && data.length > 0 && (
          <>
            <h3 className="px-1 pb-2 text-xs font-semibold text-fg-subtle">{t("chat.history.title")}</h3>
            <ul className="space-y-1.5">
              {data.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    aria-current={selectedId === t.id ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left hover:border-brand",
                      selectedId === t.id && "border-brand bg-brand/5"
                    )}
                  >
                    <span className="block truncate text-sm font-medium text-fg">{t.title}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-xs text-fg-subtle">
                      <span>{timeAgo(t.last_message_at, now)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_BADGE[t.status])}>
                        {SUPPORT_STATUS_LABELS[t.status]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
