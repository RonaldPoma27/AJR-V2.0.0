import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Botón destructivo en dos pasos (evita borrar por un click accidental). */
export default function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  disabled,
  icon,
  className,
}: {
  label: string;
  question?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-400 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10",
          className
        )}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-fg-muted">{question ?? t("confirm.question")}</span>
      <button
        type="button"
        disabled={disabled}
        autoFocus
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {confirmLabel ?? t("confirm.confirm")}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-md border px-3 py-1.5 font-medium text-fg-muted hover:bg-surface-2">
        {t("confirm.cancel")}
      </button>
    </span>
  );
}
