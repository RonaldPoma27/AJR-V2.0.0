import { Link } from "react-router-dom";
import { Menu, X, FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitch from "./LanguageSwitch";

export default function NavBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="ajr-mobile-topbar flex min-h-[4.25rem] flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/90 px-3 py-2 text-white shadow-lg shadow-black/20 backdrop-blur-xl">
      <button
        id="ajr-sidebar-trigger"
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-cyan-300/40 hover:bg-white/10"
        aria-label={sidebarOpen ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar-drawer"
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      <Link to="/" aria-label={t("nav.goHome")} className="flex min-w-0 items-center gap-2">
        <img src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 shrink-0 object-contain" />
        <span className="truncate font-display text-sm font-extrabold tracking-[0.14em]">AJR DATA</span>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <LanguageSwitch />
      </div>
      <Link to="/arrepentimiento" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15" aria-label="Botón de arrepentimiento">
        <FileCheck className="h-4 w-4" aria-hidden="true" />
        <span>{t("regret.button")}</span>
      </Link>
    </header>
  );
}
