import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { dismissToast, useToasts, type ToastItem, type ToastKind } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
// Colores sólidos (sin transparencias): borde lateral e ícono por tipo.
const BORDER: Record<ToastKind, string> = {
  success: "border-l-green-600 dark:border-l-green-400",
  error: "border-l-red-600 dark:border-l-red-400",
  info: "border-l-brand dark:border-l-accent",
};
const TEXT: Record<ToastKind, string> = {
  success: "text-green-700 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  info: "text-accent",
};

function Toast({ item }: { item: ToastItem }) {
  const { t } = useTranslation();
  const timer = useRef<number>();
  const Icon = ICONS[item.kind];

  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => dismissToast(item.id), item.duration);
  };
  const pause = () => window.clearTimeout(timer.current);

  useEffect(() => {
    start();
    return pause;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className={cn(
        "pointer-events-auto flex w-full animate-toast-in items-start gap-3 rounded-lg border border-l-4 bg-surface p-3.5 shadow-lg motion-reduce:animate-none",
        BORDER[item.kind]
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TEXT[item.kind])} strokeWidth={1.75} aria-hidden />
      <p className="min-w-0 flex-1 break-words text-sm text-fg">{item.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label={t("toast.close")}
        className="shrink-0 rounded p-0.5 text-fg-subtle hover:bg-surface-2 hover:text-fg"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

/** Contenedor de toasts (abajo a la izquierda en escritorio; arriba del borde inferior en móvil). Montarlo una sola vez. */
export default function Toaster() {
  const { t } = useTranslation();
  const items = useToasts();
  return (
    <section
      aria-label={t("toast.region")}
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-96"
    >
      <ol role="status" aria-live="polite" className="flex flex-col gap-2">
        {items.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </ol>
    </section>
  );
}
