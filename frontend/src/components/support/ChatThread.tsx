import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MAX_CONSECUTIVE_MESSAGES,
  MAX_MESSAGE_LENGTH,
  useSendSupportMessage,
  useSupportTicket,
  type SupportMessage,
} from "@/api/support";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cuántos mensajes seguidos del cliente hay al final del hilo. */
function trailingCustomerMessages(messages: SupportMessage[]): number {
  let n = 0;
  for (let i = messages.length - 1; i >= 0 && messages[i].from_customer; i--) n++;
  return n;
}

/**
 * Conversación de un chat de soporte + caja para escribir.
 * `perspective` define de qué lado se dibujan los globos: "customer" (burbuja del cliente) o
 * "staff" (panel de administración). Las reglas (2 mensajes seguidos, 2000 caracteres, chat
 * cerrado) las hace cumplir el backend; acá solo se reflejan con `can_send`.
 */
export default function ChatThread({
  ticketId,
  perspective,
  className,
}: {
  ticketId: number;
  perspective: "customer" | "staff";
  className?: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSupportTicket(ticketId);
  const send = useSendSupportMessage(ticketId);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const messageCount = data?.messages.length ?? 0;

  // Baja al último mensaje cuando llega uno nuevo (sin mover la página entera).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount, ticketId]);

  if (isLoading) return <p className="p-4 text-sm text-fg-subtle">{t("chat.thread.loading")}</p>;
  if (isError || !data) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">
        {t("chat.thread.loadError")}{" "}
        <button onClick={() => refetch()} className="font-medium underline">{t("chat.thread.retry")}</button>
      </p>
    );
  }

  const customer = perspective === "customer";
  const blocked = !data.can_send;
  const trailing = trailingCustomerMessages(data.messages);
  const remaining = MAX_CONSECUTIVE_MESSAGES - trailing;
  const trimmed = text.trim();

  function submit() {
    if (!trimmed || blocked || send.isPending) return;
    send.mutate(trimmed, { onSuccess: () => setText("") });
  }

  const placeholder =
    data.block_reason === "closed"
      ? t("chat.thread.closedPlaceholder")
      : data.block_reason === "awaiting_support"
        ? t("chat.thread.awaitingPlaceholder")
        : customer
          ? t("chat.thread.customerPlaceholder")
          : t("chat.thread.staffPlaceholder");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("chat.thread.logLabel", { title: data.title })}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {data.messages.map((m) => {
          const mine = customer ? m.from_customer : !m.from_customer;
          const author = m.from_customer ? (customer ? t("chat.thread.you") : m.sender_name) : customer ? t("chat.thread.team") : m.sender_name;
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                  mine
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-slate-200 text-slate-900 dark:bg-slate-600/40 dark:text-slate-50"
                )}
              >
                {m.content}
              </div>
              <p className="mt-1 px-1 text-xs text-fg-subtle">
                {author} · {formatDateTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t p-3">
        {blocked && (
          <p role="status" className="mb-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            {data.block_reason === "closed"
              ? t("chat.thread.blockedClosed")
              : t("chat.thread.blockedConsecutive", { count: MAX_CONSECUTIVE_MESSAGES })}
          </p>
        )}
        {customer && !blocked && remaining === 1 && (
          <p className="mb-2 text-xs text-fg-subtle">
            {t("chat.thread.oneMore")}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={blocked}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            placeholder={placeholder}
            aria-label={t("chat.thread.writeLabel")}
            className="min-h-[2.75rem] flex-1 resize-none rounded-md border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70"
          />
          <button
            type="button"
            onClick={submit}
            disabled={blocked || !trimmed || send.isPending}
            aria-label={t("chat.thread.sendLabel")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-1 flex justify-between text-xs text-fg-subtle">
          <span>{t("chat.thread.keys")}</span>
          <span className={cn(text.length >= MAX_MESSAGE_LENGTH - 100 && "font-semibold text-amber-700 dark:text-amber-300")} aria-live="polite">
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
        {send.isError && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {getServerDetail(send.error) ?? t("chat.thread.sendError")}
          </p>
        )}
      </div>
    </div>
  );
}
