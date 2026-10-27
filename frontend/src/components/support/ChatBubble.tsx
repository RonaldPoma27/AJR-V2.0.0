import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSupportTicket } from "@/api/support";
import { cn } from "@/lib/utils";
import ChatHistory from "./ChatHistory";
import ChatThread from "./ChatThread";
import NewChatForm from "./NewChatForm";

type View = { name: "history" } | { name: "new" } | { name: "thread"; id: number };

function ThreadTitle({ id }: { id: number }) {
  const { t } = useTranslation();
  const { data } = useSupportTicket(id);
  return <>{data?.title ?? t("chat.chatFallback")}</>;
}

const CHAT_MOTION_MS = 430;

/** Burbuja de soporte con transición visual entre el lanzador y la ventana. */
export default function ChatBubble() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>({ name: "history" });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const openChat = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setMounted(true);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
      launcherRef.current?.focus();
    }, CHAT_MOTION_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const title =
    view.name === "history" ? t("chat.support") : view.name === "new" ? t("chat.newChat") : <ThreadTitle id={view.id} />;

  return (
    <>
      {mounted && (
        <section
          role="dialog"
          aria-label={t("chat.bubbleTitle")}
          aria-modal="false"
          className={cn("ajr-chat-window fixed z-50 flex flex-col overflow-hidden", open ? "ajr-chat-window--open" : "ajr-chat-window--closing")}
        >
          <header className="ajr-chat-window-header">
            {view.name !== "history" && (
              <button
                type="button"
                onClick={() => setView({ name: "history" })}
                aria-label={t("chat.backToHistory")}
                className="ajr-chat-header-action"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            <div className="ajr-chat-header-brand-mark" aria-hidden="true"><MessageCircle className="h-4 w-4" /></div>
            <h2 className="ajr-chat-window-title">{title}</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={closeChat}
              aria-label={t("chat.closeChat")}
              className="ajr-chat-header-action"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="ajr-chat-window-body">
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
        onClick={() => open ? closeChat() : openChat()}
        aria-expanded={open}
        aria-label={open ? t("chat.closeSupport") : t("chat.openSupport")}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        data-open={open}
        className="ajr-chat-launcher fixed z-50 flex items-center justify-center rounded-full text-white focus-visible:outline-offset-4"
      >
        <span className="ajr-chat-launcher-glow" aria-hidden="true" />
        <span className="ajr-chat-launcher-icon" aria-hidden="true">
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
        </span>
        {!open && <span className="ajr-chat-launcher-hint">{t("chat.support")}</span>}
      </button>
    </>
  );
}
