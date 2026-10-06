import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSupportTicket } from "@/api/support";
import ChatHistory from "./ChatHistory";
import ChatThread from "./ChatThread";
import NewChatForm from "./NewChatForm";

type View = { name: "history" } | { name: "new" } | { name: "thread"; id: number };

function ThreadTitle({ id }: { id: number }) {
  const { t } = useTranslation();
  const { data } = useSupportTicket(id);
  return <>{data?.title ?? t("chat.chatFallback")}</>;
}

/**
 * Burbuja de soporte (abajo a la derecha, azul oscuro institucional). Se abre como un panel con tres
 * vistas: historial de chats, chat nuevo (con título) y conversación.
 */
export default function ChatBubble() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "history" });
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const title =
    view.name === "history" ? t("chat.support") : view.name === "new" ? t("chat.newChat") : <ThreadTitle id={view.id} />;

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={t("chat.bubbleTitle")}
          className="fixed bottom-24 right-4 z-50 flex h-[34rem] max-h-[calc(100vh-7rem)] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-surface shadow-2xl sm:right-6"
        >
          <header className="flex items-center gap-2 bg-slate-800 px-3 py-3 text-white dark:bg-slate-700">
            {view.name !== "history" && (
              <button
                type="button"
                onClick={() => setView({ name: "history" })}
                aria-label={t("chat.backToHistory")}
                className="rounded-md p-1 hover:bg-white/15"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label={t("chat.closeChat")}
              className="rounded-md p-1 hover:bg-white/15"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            {view.name === "history" && (
              <ChatHistory onNew={() => setView({ name: "new" })} onSelect={(id) => setView({ name: "thread", id })} />
            )}
            {view.name === "new" && (
              <NewChatForm
                onCreated={(id) => setView({ name: "thread", id })}
                onCancel={() => setView({ name: "history" })}
              />
            )}
            {view.name === "thread" && (
              <ChatThread key={view.id} ticketId={view.id} perspective="customer" className="flex-1" />
            )}
          </div>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("chat.closeSupport") : t("chat.openSupport")}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-900 focus-visible:outline-offset-4 sm:right-6 dark:bg-slate-600 dark:hover:bg-slate-500"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-7 w-7" aria-hidden />}
      </button>
    </>
  );
}
