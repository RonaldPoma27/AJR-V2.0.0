import { useTranslation } from "react-i18next";

/** "El equipo está escribiendo…" con tres puntos animados. */
export default function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div role="status" className="ajr-chat-typing flex items-center gap-2 px-1 text-xs text-fg-subtle">
      <span className="ajr-chat-typing-bubble flex items-center gap-1 rounded-2xl rounded-bl-sm px-3 py-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 160}ms` }}
            className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-slate-500 motion-reduce:animate-none dark:bg-slate-300"
          />
        ))}
      </span>
      <span>{t("chat.thread.typing")}</span>
    </div>
  );
}
