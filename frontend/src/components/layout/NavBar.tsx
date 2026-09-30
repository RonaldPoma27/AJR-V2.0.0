import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const mainLinks = [
  { to: "/", label: "Inicio", end: true },
  { to: "/portfolio", label: "Portfolio", end: false },
];

const nosotrosItems = [
  { to: "/solicitar-proyecto", label: "Contacto" },
  { to: "/trabaja-con-nosotros", label: "Trabajá con nosotros" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn("text-sm font-medium text-gray-600 hover:text-brand", isActive && "text-brand");

/**
 * Desplegable "Nosotros" (desktop).
 * - Mouse: abre al pasar el cursor; un click lo "fija" abierto.
 * - Teclado: Enter/Espacio/↓ abren, ↑/↓/Home/End navegan, Escape cierra (y vuelve al botón).
 * - Se cierra al hacer click afuera, al perder el foco con Tab y al cambiar de página.
 */
function NosotrosMenu({ active }: { active: boolean }) {
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
          // detail === 0: se activó con teclado (Enter/Espacio) → pasamos el foco al menú.
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
          "flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-brand",
          active && "text-brand"
        )}
      >
        Nosotros
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 pt-2">
          <ul
            id="menu-nosotros"
            role="menu"
            aria-label="Nosotros"
            onKeyDown={handleMenuKeyDown}
            className="w-52 rounded-md border bg-white py-1 shadow-lg"
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
                      "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-brand focus:bg-gray-50 focus:text-brand focus:outline-none",
                      isActive && "font-semibold text-brand"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileNosotrosOpen, setMobileNosotrosOpen] = useState(false);
  const nosotrosActive = nosotrosItems.some((item) => item.to === pathname);

  // Al navegar se cierra el menú mobile; si la página es de Nosotros, deja la sección abierta.
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

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4" aria-label="Principal">
        <Link to="/" className="text-lg font-bold text-brand">
          AJR Data
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {mainLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <NosotrosMenu active={nosotrosActive} />
        </div>

        {/* Mobile: botón hamburguesa */}
        <button
          type="button"
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
          aria-controls="menu-mobile"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile: panel */}
      {mobileOpen && (
        <div id="menu-mobile" className="border-t px-6 py-3 md:hidden">
          <ul className="space-y-1">
            {mainLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn("block rounded-md px-2 py-2 text-sm font-medium text-gray-700", isActive && "text-brand")
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-expanded={mobileNosotrosOpen}
                aria-controls="menu-mobile-nosotros"
                onClick={() => setMobileNosotrosOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-gray-700",
                  nosotrosActive && "text-brand"
                )}
              >
                Nosotros
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", mobileNosotrosOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {mobileNosotrosOpen && (
                <ul id="menu-mobile-nosotros" className="ml-3 space-y-1 border-l pl-3">
                  {nosotrosItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn("block rounded-md px-2 py-2 text-sm text-gray-600", isActive && "font-semibold text-brand")
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
