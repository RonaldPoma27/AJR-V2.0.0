import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken, useMe } from "@/api/auth";
import ChatBubble from "@/components/support/ChatBubble";
import Footer from "./Footer";
import NavBar from "./NavBar";
import { SidebarDesktop, SidebarDrawer } from "./Sidebar";

/**
 * Marco de todo el sitio.
 * - Sin sesión: NavBar + contenido + Footer (sitio público).
 * - Con sesión: layout empresarial, con la NavBar arriba y un Sidebar a la izquierda
 *   (en mobile el Sidebar es un cajón que se abre desde la NavBar).
 * - Cualquier usuario con sesión (cliente, técnico o admin): burbuja de chat de soporte abajo a la derecha.
 */
export default function AppLayout() {
  const hasSession = Boolean(getToken());
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // En /cuenta/soporte el chat ya está a pantalla completa: la burbuja sobraría.
  const showBubble = Boolean(me) && !pathname.startsWith("/cuenta/soporte");

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar hasSession={hasSession} sidebarOpen={drawerOpen} onToggleSidebar={() => setDrawerOpen((v) => !v)} />
      <div className="flex flex-1">
        {hasSession && <SidebarDesktop />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
      {hasSession && <SidebarDrawer open={drawerOpen} onClose={closeDrawer} />}
      {showBubble && <ChatBubble />}
    </div>
  );
}
