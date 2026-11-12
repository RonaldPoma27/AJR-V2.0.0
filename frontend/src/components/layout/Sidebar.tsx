import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FileCheck,
  Layers,
  Home,
  Image as ImageIcon,
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
import LanguageSwitch from "./LanguageSwitch";

interface Item {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

const ACCOUNT_ITEMS: Item[] = [
  { to: "/cuenta", labelKey: "sidebar.account", icon: User, end: true },
  { to: "/cuenta/seguridad", labelKey: "security.title", icon: ShieldCheck },
];
const USER_ITEMS: Item[] = [
  { to: "/cuenta/pedidos", labelKey: "sidebar.myOrders", icon: Package },
  { to: "/cuenta/soporte", labelKey: "sidebar.support", icon: LifeBuoy },
];
const PANEL_ITEMS: Item[] = [
  { to: "/admin/pedidos", labelKey: "sidebar.orders", icon: ClipboardList },
  { to: "/admin/postulaciones", labelKey: "sidebar.applications", icon: FileText },
  { to: "/admin/soporte", labelKey: "sidebar.adminSupport", icon: MessagesSquare },
  { to: "/admin/portfolio", labelKey: "sidebar.portfolio", icon: ImageIcon },
  { to: "/admin/proyectos-agiles", labelKey: "agile.title", icon: Layers },
  { to: "/admin/equipo", labelKey: "sidebar.team", icon: Users },
];
const TRASH_ITEM: Item = { to: "/admin/papelera", labelKey: "sidebar.trash", icon: Trash2 };
const AUDIT_ITEM: Item = { to: "/admin/auditoria", labelKey: "sidebar.audit", icon: ScrollText };
const PUBLIC_ITEMS: Item[] = [
  { to: "/", labelKey: "sidebar.home", icon: Home, end: true },
  { to: "/portfolio", labelKey: "sidebar.portfolio", icon: Briefcase },
  { to: "/solicitar-proyecto", labelKey: "sidebar.requestProject", icon: ClipboardList },
  { to: "/trabaja-con-nosotros", labelKey: "sidebar.work", icon: Users },
  { to: "/arrepentimiento", labelKey: "regret.button", icon: FileCheck },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function NavGroup({
  title,
  items,
  collapsed = false,
}: {
  title?: string;
  items: Item[];
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-2">
      {title && !collapsed && (
        <p className="px-3 pb-2 pt-4 text-[0.64rem] font-bold uppercase tracking-[0.18em] text-slate-400">
          {title}
        </p>
      )}
      {title && collapsed && <div className="mx-auto my-3 h-px w-7 bg-white/10" aria-hidden="true" />}
      <ul className="space-y-1">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              title={collapsed ? t(labelKey) : undefined}
              aria-label={collapsed ? t(labelKey) : undefined}
              className={({ isActive }) =>
                cn(
                  "ajr-nav-link flex min-h-10 items-center rounded-xl text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white",
                  collapsed ? "justify-center px-2" : "gap-3 px-3 py-2.5",
                  isActive && "bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-300/15 hover:bg-cyan-400/10 hover:text-cyan-100"
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && <span className="min-w-0 truncate">{t(labelKey)}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarLinks({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const { data: me, isLoading } = useMe();

  if (isLoading && !me) {
    return <div className="space-y-2 p-2" aria-label={t("sidebar.loading")}>
      {[0, 1, 2, 3].map((item) => <div key={item} className={cn("h-10 animate-pulse rounded-xl bg-white/[0.06]", collapsed ? "mx-auto w-10" : "w-full")} />)}
    </div>;
  }

  if (!me) return <NavGroup title={t("sidebar.site")} items={PUBLIC_ITEMS} collapsed={collapsed} />;

  return (
    <>
      <NavGroup items={ACCOUNT_ITEMS} collapsed={collapsed} />
      {me.role === "USER" && <NavGroup title={t("sidebar.account")} items={USER_ITEMS} collapsed={collapsed} />}
      {isStaff(me.role) && (
        <NavGroup
          title={t("sidebar.adminPanel")}
          items={me.role === "ADMIN" ? [...PANEL_ITEMS, AUDIT_ITEM, TRASH_ITEM] : PANEL_ITEMS}
          collapsed={collapsed}
        />
      )}
      <NavGroup title={t("sidebar.site")} items={PUBLIC_ITEMS} collapsed={collapsed} />
    </>
  );
}

/** Sidebar persistente y flotante para escritorio. El estado compacto lo controla AppLayout. */
export function SidebarDock({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  const displayName = me ? me.full_name || me.email : "";

  return (
    <aside
      className={cn(
        "ajr-sidebar-dock sticky top-4 flex h-[calc(100vh-2rem)] max-h-[920px] shrink-0 flex-col rounded-[1.35rem] border border-white/10 bg-[#0b1220]/95 text-white shadow-[0_20px_70px_rgba(0,0,0,.36)] backdrop-blur-xl transition-[width] duration-300",
        collapsed ? "w-[5.35rem]" : "w-[17.25rem]"
      )}
      data-collapsed={collapsed}
    >
      <div className={cn("flex min-h-[5.2rem] items-center border-b border-white/[0.08]", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
        <Link to="/" aria-label="AJR Data — inicio" className="flex min-w-0 items-center gap-3">
          <img src="/logo.png" alt="" width={44} height={44} className="h-10 w-10 shrink-0 object-contain" />
          {!collapsed && <span className="min-w-0">
            <span className="block font-display text-sm font-extrabold tracking-[0.16em]">AJR DATA</span>
            <span className="mt-1 block text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-cyan-200/70">Systems · Data · Design</span>
          </span>}
        </Link>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col", collapsed ? "px-2" : "px-3")}>
        {me && <div className={cn("my-3 flex min-h-12 items-center rounded-xl bg-white/[0.045]", collapsed ? "justify-center p-1" : "gap-3 px-3 py-2")}>
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white">
            {initials(displayName)}
          </span>
          {!collapsed && <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">{displayName}</span>
            <span className="block text-[0.65rem] text-slate-400">{t(`sidebar.roles.${me.role}`)}</span>
          </span>}
        </div>}

        <nav aria-label={t("sidebar.navLabel")} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
          <SidebarLinks collapsed={collapsed} />
        </nav>
      </div>

      <div className={cn("border-t border-white/[0.08] p-2", collapsed ? "space-y-2" : "space-y-1")}>
        <div className={cn("flex min-h-9 items-center", collapsed ? "justify-center" : "px-2")}><LanguageSwitch /></div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          aria-expanded={!collapsed}
          className={cn("ajr-nav-link flex min-h-10 w-full items-center rounded-xl border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white", collapsed ? "justify-center" : "justify-between px-3")}
        >
          {!collapsed && <span className="text-xs">{t("sidebar.collapse")}</span>}
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
        {me ? (
          <button
            type="button"
            onClick={logout}
            title={collapsed ? t("sidebar.logout") : undefined}
            aria-label={t("sidebar.logout")}
            className={cn("ajr-nav-link flex min-h-10 w-full items-center rounded-xl text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white", collapsed ? "justify-center" : "gap-3 px-3")}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            {!collapsed && t("sidebar.logout")}
          </button>
        ) : (
          <div className="grid gap-1">
            <Link to="/login" title={collapsed ? t("nav.login") : undefined} aria-label={t("nav.login")} className={cn("flex min-h-10 items-center justify-center rounded-xl border border-white/10 text-sm font-medium text-slate-200 hover:bg-white/[0.06]", !collapsed && "gap-2")}>
              <LogIn className="h-4 w-4" aria-hidden="true" />{!collapsed && t("nav.login")}
            </Link>
            <Link to="/registro" title={collapsed ? t("nav.register") : undefined} aria-label={t("nav.register")} className={cn("flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-sm font-semibold text-white hover:brightness-110", !collapsed && "gap-2")}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />{!collapsed && t("nav.register")}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Drawer accesible para pantallas pequeñas y medianas. */
export function SidebarDrawer({ open, onClose, hasSession }: { open: boolean; onClose: () => void; hasSession: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const logout = useLogout();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) onClose();
    // El drawer debe cerrarse al cambiar de ruta.
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

    const frame = window.requestAnimationFrame(() => (getFocusable()[0] ?? panel)?.focus());
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
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.getElementById("ajr-sidebar-trigger")?.focus();
    };
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-[70] transition-[visibility] duration-200 lg:hidden", open ? "visible" : "invisible pointer-events-none")} aria-hidden={!open}>
      <button type="button" tabIndex={-1} aria-label={t("nav.closeMenu")} onClick={onClose} className={cn("absolute inset-0 bg-[#050914]/80 backdrop-blur-sm transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} />
      <div
        ref={panelRef}
        id="sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("sidebar.drawerLabel")}
        tabIndex={-1}
        className={cn("ajr-mobile-panel relative flex h-full w-[min(22rem,88vw)] max-w-full flex-col overflow-hidden border-r border-white/10 shadow-2xl transition-transform duration-300 ease-out", open ? "translate-x-0" : "-translate-x-full")}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link to="/" className="flex items-center gap-3" aria-label="AJR Data — inicio">
            <img src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 object-contain" />
            <span className="text-sm font-extrabold tracking-[0.16em] text-white">AJR DATA</span>
          </Link>
          <button type="button" aria-label={t("nav.closeMenu")} onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SidebarLinks />
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">{t("lang.label")}</span>
            <LanguageSwitch />
          </div>
          {hasSession ? (
            <button type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]" aria-label={t("sidebar.logout")}>
              <LogOut className="h-4 w-4" aria-hidden="true" />{t("sidebar.logout")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/login" onClick={onClose} className="flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]">{t("nav.login")}</Link>
              <Link to="/registro" onClick={onClose} className="flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 text-sm font-semibold text-white transition hover:brightness-110">{t("nav.register")}</Link>
            </div>
          )}
          <p className="mt-3 text-[0.68rem] text-slate-500">Systems · Data · Design <ArrowUpRight className="inline h-3 w-3" aria-hidden="true" /></p>
        </div>
      </div>
    </div>
  );
}
