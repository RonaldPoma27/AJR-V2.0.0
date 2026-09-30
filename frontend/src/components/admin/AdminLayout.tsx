import { Link, NavLink, Outlet } from "react-router-dom";
import { useLogout, useMe } from "@/api/auth";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin/pedidos", label: "Pedidos" },
  { to: "/admin/postulaciones", label: "Postulaciones" },
  { to: "/admin/perfil", label: "Mi perfil" },
];

/** Marco del panel: sidebar en desktop, barra superior en mobile. */
export default function AdminLayout() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="border-b bg-white md:flex md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Link to="/admin/pedidos" className="text-lg font-bold text-brand">
            AJR Data <span className="text-sm font-medium text-gray-400">· Panel</span>
          </Link>
        </div>

        <nav aria-label="Panel admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100",
                  isActive && "bg-brand/10 text-brand"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t px-5 py-4 text-sm md:block">
          {me && (
            <p className="truncate text-gray-500" title={me.email}>
              {me.full_name || me.email}
            </p>
          )}
          <Link to="/" className="mt-2 block text-gray-500 hover:text-brand">
            ← Volver al sitio
          </Link>
          <button onClick={logout} className="mt-2 font-medium text-gray-700 hover:text-brand">
            Cerrar sesión
          </button>
        </div>
        {/* Mobile: acciones en una fila */}
        <div className="flex items-center justify-between border-t px-5 py-2 text-sm md:hidden">
          <Link to="/" className="text-gray-500">← Sitio</Link>
          <button onClick={logout} className="font-medium text-gray-700">Cerrar sesión</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
