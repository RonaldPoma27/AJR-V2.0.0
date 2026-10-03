import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import LanguageSwitch from "./LanguageSwitch";
import ThemeToggle from "./ThemeToggle";

const mainLinks = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/portfolio", labelKey: "nav.portfolio", end: false },
];

const nosotrosItems = [
  { to: "/solicitar-proyecto", labelKey: "nav.contact" },
  { to: "/trabaja-con-nosotros", labelKey: "nav.work" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm font-medium text-gray-300 hover:text-white",
    isActive && "text-white"
  );

/**
 * Desplegable "Nosotros" (desktop).
 * - Mouse: abre al pasar el cursor; un click lo "fija" abierto.
 * - Teclado: Enter/Espacio/↓ abren, ↑/↓/Home/End navegan, Escape cierra (y vuelve al botón).
 * - Se cierra al hacer click afuera, al perder el foco con Tab y al cambiar de página.
 */
function NosotrosMenu({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const focusOnOpen = useRef(false);
  const { pathname } = useLocation();

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  useEffect(close, [pathname]);

  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false;
      itemRefs.current[0]?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function focusItem(index: number) {
    const count = nosotrosItems.length;
    itemRefs.current[(index + count) % count]?.focus();
  }

  function handleButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOnOpen.current = true;
      setOpen(true);
      setPinned(true);
    } else if (e.key === "Escape") {
      close();
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(nosotrosItems.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close();
        buttonRef.current?.focus();
        break;
      case "Tab":
        close();
        break;
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="menu-nosotros"
        onClick={(e) => {
          if (e.detail === 0 && !pinned) focusOnOpen.current = true;
          if (pinned) {
            close();
          } else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onKeyDown={handleButtonKeyDown}
        className={cn(
          "flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white",
          active && "text-white"
        )}
      >
        {t("nav.about")}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 pt-2">
          <ul
            id="menu-nosotros"
            role="menu"
            aria-label={t("nav.about")}
            onKeyDown={handleMenuKeyDown}
            className="w-52 rounded-md border bg-surface py-1 text-fg shadow-lg"
          >
            {nosotrosItems.map((item, index) => (
              <li key={item.to} role="none">
                <NavLink
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  to={item.to}
                  role="menuitem"
                  className={({ isActive }) =>
                    cn(
                      "block px-4 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-accent focus:bg-surface-2 focus:text-accent focus:outline-none",
                      isActive && "font-semibold text-accent"
                    )
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * El logo es un PNG con fondo casi negro (sin transparencia). `mix-blend-lighten` hace que ese
 * negro se funda con el color de la barra, y el recorte deja solo la marca.
 */
function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" aria-label={t("nav.goHome")} className="relative block h-12 w-28 shrink-0 overflow-hidden rounded-sm bg-transparent">
      <img
        src="/logo.png"
        alt="AJR Data"
        width={140}
        height={140}
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-lighten"
        style={{ width: 140, height: 140 }}
      />
    </Link>
  );
}

const authButtonBase = "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium";

export default function NavBar({
  hasSession,
  sidebarOpen,
  onToggleSidebar,
}: {
  hasSession: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileNosotrosOpen, setMobileNosotrosOpen] = useState(false);
  const nosotrosActive = nosotrosItems.some((item) => item.to === pathname);

  useEffect(() => {
    setMobileOpen(false);
    setMobileNosotrosOpen(nosotrosActive);
  }, [pathname, nosotrosActive]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "block rounded-md px-2 py-2 text-sm font-medium text-gray-200 hover:bg-white/10",
      isActive && "text-white"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6" aria-label={t("nav.main")}>
        <Logo />

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {mainLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {t(link.labelKey)}
            </NavLink>
          ))}
          <NosotrosMenu active={nosotrosActive} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch />
          <ThemeToggle />

          {!hasSession && (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className={cn(authButtonBase, "border border-white/25 text-white hover:bg-white/10")}>
                {t("nav.login")}
              </Link>
              <Link to="/registro" className={cn(authButtonBase, "bg-brand text-white hover:bg-brand-dark")}>
                {t("nav.register")}
              </Link>
            </div>
          )}

          {/* Mobile: Menu button */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-200 hover:bg-white/10 md:hidden"
            aria-label={(hasSession ? sidebarOpen : mobileOpen) ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={hasSession ? sidebarOpen : mobileOpen}
            aria-controls={hasSession ? "sidebar-drawer" : "menu-mobile"}
            onClick={() => (hasSession ? onToggleSidebar() : setMobileOpen((v) => !v))}
          >
            {(hasSession ? sidebarOpen : mobileOpen) ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Mobile sin sesión: panel */}
      {!hasSession && mobileOpen && (
        <div id="menu-mobile" className="border-t border-white/10 px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {mainLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={mobileLinkClass}>
                  {t(link.labelKey)}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-expanded={mobileNosotrosOpen}
                aria-controls="menu-mobile-nosotros"
                onClick={() => setMobileNosotrosOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
              >
                {t("nav.about")}
                <ChevronDown className={cn("h-4 w-4 transition-transform", mobileNosotrosOpen && "rotate-180")} aria-hidden />
              </button>
              {mobileNosotrosOpen && (
                <ul id="menu-mobile-nosotros" className="ml-3 space-y-1 border-l border-white/15 pl-3">
                  {nosotrosItems.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} className={mobileLinkClass}>
                        {t(item.labelKey)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link to="/login" className={cn(authButtonBase, "border border-white/25 text-white hover:bg-white/10")}>
              {t("nav.login")}
            </Link>
            <Link to="/registro" className={cn(authButtonBase, "bg-brand text-white hover:bg-brand-dark")}>
              {t("nav.register")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
