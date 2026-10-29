import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  ClipboardList,
  FileText,
  Home,
  Image as ImageIcon,
  Layers,
  LifeBuoy,
  LogIn,
  LogOut,
  MessagesSquare,
  Package,
  ScrollText,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  X,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isStaff, useLogout, useMe } from "@/api/auth";
import { cn } from "@/lib/utils";

interface Item {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

const ACCOUNT_ITEMS: Item[] = [
  { to: "/cuenta", labelKey: "sidebar.account", icon: User, end: true },
  { to: "/cuenta/seguridad", labelKey: "sidebar.accountSecurity", icon: ShieldCheck },
];

// Menú del cliente.
const USER_ITEMS: Item[] = [
  { to: "/cuenta/pedidos", labelKey: "sidebar.myOrders", icon: Package },
  { to: "/cuenta/soporte", labelKey: "sidebar.support", icon: LifeBuoy },
];

// "Panel de Administración" (ADMIN y TECHNICIAN).
const PANEL_ITEMS: Item[] = [
  { to: "/admin/pedidos", labelKey: "sidebar.orders", icon: ClipboardList },
  { to: "/admin/postulaciones", labelKey: "sidebar.applications", icon: FileText },
  { to: "/admin/soporte", labelKey: "sidebar.adminSupport", icon: MessagesSquare },
  { to: "/admin/portfolio", labelKey: "sidebar.portfolio", icon: ImageIcon },
  { to: "/admin/equipo", labelKey: "sidebar.team", icon: Users },
  { to: "/admin/proyectos-agiles", labelKey: "sidebar.agileProjects", icon: Layers },
];
const TRASH_ITEM: Item = { to: "/admin/papelera", labelKey: "sidebar.trash", icon: Trash2 };
const AUDIT_ITEM: Item = { to: "/admin/auditoria", labelKey: "sidebar.audit", icon: ScrollText };

const PUBLIC_ITEMS: Item[] = [
  { to: "/", labelKey: "sidebar.home", icon: Home, end: true },
  { to: "/portfolio", labelKey: "sidebar.portfolio", icon: Briefcase },
  { to: "/solicitar-proyecto", labelKey: "sidebar.requestProject", icon: ClipboardList },
  { to: "/trabaja-con-nosotros", labelKey: "sidebar.work", icon: Users },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function NavGroup({ title, items }: { title?: string; items: Item[] }) {
  const { t } = useTranslation();
  return (
    <div>
      {title && <p className="px-3 pb-1 pt-4 text-xs font-semibold text-fg-subtle">{title}</p>}
      <ul className="space-y-0.5">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "ajr-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg",
                  isActive && "bg-brand/10 text-accent hover:bg-brand/10 hover:text-accent"
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {t(labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Contenido del menú: lo comparten la barra fija (desktop) y el cajón (mobile). */
function SidebarContent({ showPublicLinks }: { showPublicLinks: boolean }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  const name = me ? me.full_name || me.email : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 pr-14">
        {me ? (
          <>
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg" title={me.email}>{name}</p>
              <p className="text-xs text-fg-subtle">{t(`sidebar.roles.${me.role}`)}</p>
            </div>
          </>
        ) : (
          <div className="h-10 w-full animate-pulse rounded-md bg-surface-2" aria-label={t("sidebar.loading")} />
        )}
      </div>

      <nav aria-label={t("sidebar.navLabel")} className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup items={ACCOUNT_ITEMS} />
        {me?.role === "USER" && <NavGroup items={USER_ITEMS} />}
        {isStaff(me?.role) && (
          <NavGroup
            title={t("sidebar.adminPanel")}
            items={me?.role === "ADMIN" ? [...PANEL_ITEMS, AUDIT_ITEM, TRASH_ITEM] : PANEL_ITEMS}
          />
        )}
        {showPublicLinks && <NavGroup title={t("sidebar.site")} items={PUBLIC_ITEMS} />}
      </nav>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={logout}
          className="ajr-nav-link flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          {t("sidebar.logout")}
        </button>
      </div>
    </div>
  );
}

/** Navegación para visitas sin iniciar sesión. */
function PublicDrawerContent() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5 pr-14">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white">AJR DATA</p>
        <p className="mt-1 text-sm text-white">Software · Datos · IA</p>
      </div>
      <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup title={t("sidebar.site")} items={PUBLIC_ITEMS} />
      </nav>
      <div className="grid gap-2 border-t border-white/10 p-3">
        <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10">
          <LogIn className="h-4 w-4" aria-hidden />{t("nav.login")}
        </Link>
        <Link to="/registro" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110">
          <UserPlus className="h-4 w-4" aria-hidden />{t("nav.register")}
        </Link>
      </div>
    </div>
  );
}

/** Drawer único para escritorio y móvil, tanto para el sitio público como para las cuentas. */
export function SidebarDrawer({ open, onClose, hasSession }: { open: boolean; onClose: () => void; hasSession: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) onClose();
    // Se cierra al navegar; el drawer no debe quedar abierto entre rutas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => !element.hasAttribute("hidden"));

    requestAnimationFrame(() => (getFocusable()[0] ?? panel)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.getElementById("ajr-sidebar-trigger")?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-[60] transition-[visibility] duration-200", open ? "visible" : "invisible pointer-events-none")}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("nav.closeMenu")}
        onClick={onClose}
        className={cn("absolute inset-0 bg-[#0B0F19] transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
      />
      <div
        ref={panelRef}
        id="sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("sidebar.drawerLabel")}
        tabIndex={-1}
        className={cn(
          "ajr-mobile-panel relative flex h-full w-[min(21rem,88vw)] max-w-full flex-col overflow-hidden border-r border-white/10 shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-offset-2"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {hasSession ? <SidebarContent showPublicLinks /> : <PublicDrawerContent />}
      </div>
    </div>
  );
}
