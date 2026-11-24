import { Link, NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogIn, LogOut, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isStaff, useLogout, useMe } from "@/api/auth";
import { cn } from "@/lib/utils";
import LanguageSwitch from "./LanguageSwitch";
import {
  ACCOUNT_ITEMS, AUDIT_ITEM, PANEL_ITEMS, PUBLIC_ITEMS, TRASH_ITEM, USER_ITEMS, initials, type Item,
} from "./Sidebar";

/**
 * Sidebar flotante y colapsable (desktop ≥ lg). En móvil se usa el cajón existente (`SidebarDrawer`).
 *
 * Flota sobre el contenido (margen, bordes redondeados, glass) en vez de ocupar una columna:
 * el layout queda inmersivo y el contenido reserva solo `--rail-w` a la izquierda.
 * Colapsado muestra solo íconos con `title` + `aria-label`, así que sigue siendo operable por
 * teclado y lector de pantalla.
 */
function Group({ title, items, collapsed }: { title?: string; items: Item[]; collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <div>
      {title && !collapsed && <p className="px-3 pb-1 pt-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-fg-subtle">{title}</p>}
      {title && collapsed && <hr className="mx-3 my-3 border-white/10" aria-hidden />}
      <ul className="space-y-0.5">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              title={collapsed ? t(labelKey) : undefined}
              aria-label={collapsed ? t(labelKey) : undefined}
              className={({ isActive }) =>
                cn(
                  "ajr-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-white/5 hover:text-fg",
                  collapsed && "justify-center px-0",
                  isActive && "bg-brand/15 text-accent hover:bg-brand/15 hover:text-accent"
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{t(labelKey)}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FloatingSidebar({
  collapsed,
  onToggle,
  hasSession,
}: {
  collapsed: boolean;
  onToggle: () => void;
  hasSession: boolean;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const logout = useLogout();
  const name = me ? me.full_name || me.email : "";

  return (
    <aside
      aria-label={t("sidebar.navLabel")}
      data-collapsed={collapsed}
      className="ajr-rail fixed bottom-4 left-4 top-4 z-40 hidden flex-col overflow-hidden rounded-2xl lg:flex"
    >
      <div className={cn("flex items-center gap-2 border-b border-white/10 px-3 py-3", collapsed && "justify-center px-0")}>
        <Link to="/" aria-label={t("nav.goHome")} className="flex min-w-0 items-center gap-2">
          <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-sm font-extrabold tracking-[0.12em] text-white">AJR DATA</span>
              <span className="mt-1 truncate text-[0.52rem] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Systems · Data · Design</span>
            </span>
          )}
        </Link>
      </div>

      {hasSession && me && !collapsed && (
        <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{initials(name)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg" title={me.email}>{name}</p>
            <p className="text-xs text-fg-subtle">{t(`sidebar.roles.${me.role}`)}</p>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label={t("nav.main")}>
        <Group title={t("sidebar.site")} items={PUBLIC_ITEMS} collapsed={collapsed} />
        {hasSession && <Group title={t("sidebar.account")} items={ACCOUNT_ITEMS} collapsed={collapsed} />}
        {hasSession && me?.role === "USER" && <Group items={USER_ITEMS} collapsed={collapsed} />}
        {hasSession && isStaff(me?.role) && (
          <Group
            title={t("sidebar.adminPanel")}
            items={me?.role === "ADMIN" ? [...PANEL_ITEMS, AUDIT_ITEM, TRASH_ITEM] : PANEL_ITEMS}
            collapsed={collapsed}
          />
        )}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-2">
        {!collapsed && <div className="px-1 pb-1"><LanguageSwitch /></div>}
        {hasSession ? (
          <button type="button" onClick={logout} title={collapsed ? t("sidebar.logout") : undefined} aria-label={t("sidebar.logout")} className={cn("ajr-nav-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-white/5 hover:text-fg", collapsed && "justify-center px-0")}>
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed && t("sidebar.logout")}
          </button>
        ) : (
          <>
            <Link to="/login" title={collapsed ? t("nav.login") : undefined} aria-label={t("nav.login")} className={cn("ajr-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-white/5 hover:text-fg", collapsed && "justify-center px-0")}>
              <LogIn className="h-[18px] w-[18px] shrink-0" aria-hidden />{!collapsed && t("nav.login")}
            </Link>
            <Link to="/registro" title={collapsed ? t("nav.register") : undefined} aria-label={t("nav.register")} className={cn("flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110")}>
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />{!collapsed && t("nav.register")}
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("rail.expand") : t("rail.collapse")}
          title={collapsed ? t("rail.expand") : t("rail.collapse")}
          className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-fg-subtle transition hover:bg-white/5 hover:text-fg", collapsed && "justify-center px-0")}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <><ChevronsLeft className="h-4 w-4" aria-hidden />{t("rail.collapse")}</>}
        </button>
      </div>
    </aside>
  );
}
