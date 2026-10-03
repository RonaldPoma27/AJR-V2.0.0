import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Switch ES/EN. Muestra el idioma activo resaltado; un click alterna al otro. */
export default function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.resolvedLanguage === "en";
  const option = (active: boolean) =>
    cn(
      "rounded px-1.5 py-0.5",
      active ? "bg-brand text-white" : "text-slate-600 dark:text-gray-300"
    );

  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(isEn ? "es" : "en")}
      aria-label={isEn ? t("lang.switchToEs") : t("lang.switchToEn")}
      title={t("lang.label")}
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-md px-1 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/10",
        className
      )}
    >
      <span className={option(!isEn)} aria-hidden>ES</span>
      <span className={option(isEn)} aria-hidden>EN</span>
    </button>
  );
}
