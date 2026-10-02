import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  ClipboardList,
  FileText,
  Home,
  Image as ImageIcon,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  Package,
  Trash2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { isStaff, useLogout, useMe, type UserRole } from "@/api/auth";
import { cn } from "@/lib/utils";

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const ACCOUNT_ITEMS: Item[] = [{ to: "/cuenta", label: "Mi cuenta", icon: User, end: true }];

// Menú del cliente.
const USER_ITEMS: Item[] = [
  { to: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
  { to: "/cuenta/soporte", label: "Soporte", icon: LifeBuoy },
];

// "Panel de Administración" (ADMIN y TECHNICIAN).
const PANEL_ITEMS: Item[] = [
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/postulaciones", label: "Postulaciones", icon: FileText },
  { to: "/admin/soporte", label: "Comentarios / Soporte", icon: MessagesSquare },
  { to: "/admin/portfolio", label: "Portfolio", icon: ImageIcon },
  { to: "/admin/equipo", label: "Equipo", icon: Users },
];
const TRASH_ITEM: Item = { to: "/admin/papelera", label: "Papelera", icon: Trash2 };

const PUBLIC_ITEMS: Item[] = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/solicitar-proyecto", label: "Solicitar proyecto", icon: ClipboardList },
  { to: "/trabaja-con-nosotros", label: "Trabajá con nosotros", icon: Users },
];

const ROLE_LABEL: Record<UserRole, string> = {
  USER: "Cliente",
  TECHNICIAN: "Técnico",
  ADMIN: "Administrador",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function NavGroup({ title, items }: { title?: string; items: Item[] }) {
  return (
    <div>
      {title && <p className="px-3 pb-1 pt-4 text-xs font-semibold text-fg-subtle">{title}</p>}
      <ul className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg",
                  isActive && "bg-brand/10 text-accent hover:bg-brand/10 hover:text-accent"
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Contenido del menú: lo comparten la barra fija (desktop) y el cajón (mobile). */
function SidebarContent({ showPublicLinks }: { showPublicLinks: boolean }) {
  const { data: me } = useMe();
  const logout = useLogout();
  const name = me ? me.full_name || me.email : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-4">
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
              <p className="text-xs text-fg-subtle">{ROLE_LABEL[me.role]}</p>
            </div>
          </>
        ) : (
          <div className="h-10 w-full animate-pulse rounded-md bg-surface-2" aria-label="Cargando tu cuenta" />
        )}
      </div>

      <nav aria-label="Cuenta" className="flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup items={ACCOUNT_ITEMS} />
        {me?.role === "USER" && <NavGroup items={USER_ITEMS} />}
        {isStaff(me?.role) && (
          <NavGroup
            title="Panel de Administración"
            items={me?.role === "ADMIN" ? [...PANEL_ITEMS, TRASH_ITEM] : PANEL_ITEMS}
          />
        )}
        {showPublicLinks && <NavGroup title="Sitio" items={PUBLIC_ITEMS} />}
      </nav>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/** Desktop: columna fija a la izquierda. */
export function SidebarDesktop() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r bg-surface md:block">
      <SidebarContent showPublicLinks={false} />
    </aside>
  );
}

/** Mobile: cajón deslizable desde la izquierda. */
export function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();

  useEffect(onClose, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-30 md:hidden">
      <button type="button" aria-label="Cerrar menú" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        id="sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de la cuenta"
        className="relative h-full w-72 max-w-[85vw] border-r bg-surface shadow-xl"
      >
        <SidebarContent showPublicLinks />
      </div>
    </div>
  );
}
