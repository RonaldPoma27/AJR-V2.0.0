import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitch from "./LanguageSwitch";

function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" aria-label={t("nav.goHome")} className="ajr-brand-mark group relative flex h-12 w-32 shrink-0 items-center justify-start overflow-visible rounded-sm bg-transparent sm:w-36">
      <img
        src="/logo.png"
        alt="AJR Data"
        width={160}
        height={160}
        className="ajr-brand-logo block h-12 w-12 shrink-0 object-contain transition-transform duration-300 group-hover:scale-[1.04]"
      />
      <span className="ml-2 flex min-w-0 flex-col leading-none">
        <span className="font-display text-[0.98rem] font-extrabold tracking-[0.12em] text-white">AJR DATA</span>
        <span className="mt-1 text-[0.56rem] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">Systems · Data · Design</span>
      </span>
    </Link>
  );
}

export default function NavBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="ajr-navbar sticky top-0 z-40 border-b border-white/10 text-white">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-5 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]"
        aria-label={t("nav.main")}
      >
        <button
          id="ajr-sidebar-trigger"
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-cyan-300/40 hover:bg-white/10 focus-visible:outline-offset-4"
          aria-label={sidebarOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-drawer"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch />
        </div>
      </nav>
    </header>
  );
}
