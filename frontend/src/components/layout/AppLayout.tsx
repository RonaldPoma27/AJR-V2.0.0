import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken, useMe } from "@/api/auth";
import ChatBubble from "@/components/support/ChatBubble";
import AuroraBackground from "./AuroraBackground";
import Footer from "./Footer";
import NavBar from "./NavBar";
import { SidebarDrawer } from "./Sidebar";

/**
 * Marco de todo el sitio.
 * - Sin sesión: NavBar + contenido + Footer (sitio público).
 * - Con sesión: el acceso a cuenta y administración vive en un drawer desde la NavBar,
 *   tanto en escritorio como en móvil.
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
  const isPublicVisualRoute = !pathname.startsWith("/admin") && !pathname.startsWith("/cuenta");

  return (
    <div className="ajr-app-shell relative isolate flex min-h-screen flex-col">
      <AuroraBackground />
      <NavBar sidebarOpen={drawerOpen} onToggleSidebar={() => setDrawerOpen((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={`app-main relative flex-1 ${isPublicVisualRoute ? "ajr-public-route" : ""}`}>
          <Outlet />
        </main>
        <Footer />
      </div>
      <SidebarDrawer open={drawerOpen} onClose={closeDrawer} hasSession={hasSession} />
      {showBubble && <ChatBubble />}
    </div>
  );
}
