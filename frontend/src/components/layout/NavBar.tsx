// ... (Tus imports, mainLinks, nosotrosItems, linkClass, etc. se mantienen igual)

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

  // ... (Tus funciones focusItem, handleButtonKeyDown y handleMenuKeyDown se mantienen igual)

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
          "flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors duration-150",
          active && "text-white"
        )}
      >
        {t("nav.about")}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {/* Dropdown Animado: rápido, dinámico, entra desde arriba */}
      <div 
        className={cn(
          "absolute left-0 top-full z-20 pt-2 transition-all duration-150 ease-out origin-top-left",
          open ? "opacity-100 scale-100 translate-y-0 visible" : "opacity-0 scale-95 -translate-y-2 invisible pointer-events-none"
        )}
      >
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
                    "block px-4 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-accent focus:bg-surface-2 focus:text-accent focus:outline-none transition-colors duration-150",
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
    </div>
  );
}

// ... (El componente Logo se mantiene igual)

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
      "block rounded-md px-2 py-2 text-sm font-medium text-gray-200 hover:bg-white/10 transition-colors duration-150",
      isActive && "text-white bg-white/5"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white relative">
      <nav className="mx-auto flex min-h-[4rem] max-w-7xl items-center gap-6 px-4 sm:px-6 w-full" aria-label={t("nav.main")}>
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
              <Link to="/login" className={cn(authButtonBase, "border border-white/25 text-white hover:bg-white/10 transition-colors duration-150")}>
                {t("nav.login")}
              </Link>
              <Link to="/registro" className={cn(authButtonBase, "bg-brand text-white hover:bg-brand-dark transition-colors duration-150")}>
                {t("nav.register")}
              </Link>
            </div>
          )}

          {/* Mobile: Menu button - Fix shrink-0 añadido para evitar corte en iPhone */}
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-200 hover:bg-white/10 md:hidden transition-colors duration-150"
            aria-label={(hasSession ? sidebarOpen : mobileOpen) ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={hasSession ? sidebarOpen : mobileOpen}
            aria-controls={hasSession ? "sidebar-drawer" : "menu-mobile"}
            onClick={() => (hasSession ? onToggleSidebar() : setMobileOpen((v) => !v))}
          >
            {(hasSession ? sidebarOpen : mobileOpen) ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Panel Móvil: Slide lateral rápido */}
      {!hasSession && (
        <div 
          id="menu-mobile" 
          className={cn(
            "absolute top-full left-0 w-full bg-ink border-t border-white/10 px-4 py-3 md:hidden shadow-xl",
            "transition-all duration-200 ease-out origin-left h-[calc(100vh-4rem)] overflow-y-auto",
            mobileOpen ? "translate-x-0 opacity-100 visible" : "-translate-x-full opacity-0 invisible"
          )}
        >
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
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-gray-200 hover:bg-white/10 transition-colors duration-150"
              >
                {t("nav.about")}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", mobileNosotrosOpen && "rotate-180")} aria-hidden />
              </button>
              
              <div 
                className={cn(
                  "overflow-hidden transition-all duration-200 ease-in-out",
                  mobileNosotrosOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
                )}
              >
                <ul id="menu-mobile-nosotros" className="ml-3 space-y-1 border-l border-white/15 pl-3">
                  {nosotrosItems.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} className={mobileLinkClass}>
                        {t(item.labelKey)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 pb-10">
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
