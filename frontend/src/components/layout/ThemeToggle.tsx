import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Interruptor sol/luna del modo oscuro.
 * Mientras dura la transición de tema (`isAnimating`, ver lib/theme.tsx) el botón queda
 * deshabilitado: evita clics rápidos que apilen cambios a mitad del fundido.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { theme, toggle, isAnimating } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isAnimating}
      aria-pressed={dark}
      aria-busy={isAnimating}
      aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
      title={dark ? t("theme.light") : t("theme.dark")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",
        "disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-transparent",
        className
      )}
    >
      {/* key: el ícono se vuelve a montar y entra con un giro corto, para que el cambio se note */}
      <span key={theme} className="inline-flex animate-theme-icon">
        {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
      </span>
    </button>
  );
}
