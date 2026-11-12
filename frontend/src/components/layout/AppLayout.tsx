import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken, useMe } from "@/api/auth";
import ChatBubble from "@/components/support/ChatBubble";
import AuroraBackground from "./AuroraBackground";
import Footer from "./Footer";
import NavBar from "./NavBar";
import { SidebarDock, SidebarDrawer } from "./Sidebar";

/** Marco inmersivo global: sidebar flotante en escritorio y drawer accesible en móvil/tablet. */
export default function AppLayout() {
  const hasSession = Boolean(getToken());
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // La pantalla de soporte ya contiene el chat a pantalla completa.
  const showBubble = Boolean(me) && !pathname.startsWith("/cuenta/soporte");
  const isPublicVisualRoute = !pathname.startsWith("/admin") && !pathname.startsWith("/cuenta");

  return (
    <div className="ajr-app-shell relative isolate flex min-h-screen gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-5">
      <AuroraBackground />
      <div className="relative z-10 hidden shrink-0 lg:block">
        <SidebarDock collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
        <div className="lg:hidden">
          <NavBar sidebarOpen={drawerOpen} onToggleSidebar={() => setDrawerOpen((value) => !value)} />
        </div>
        <main
          className={`app-main relative mx-auto w-full max-w-[1680px] flex-1 ${isPublicVisualRoute ? "ajr-public-route" : ""} ${pathname === "/" ? "ajr-home-route" : "ajr-internal-route"}`}
          data-route={pathname}
        >
          <Outlet />
        </main>
        <Footer />
      </div>

      <SidebarDrawer open={drawerOpen} onClose={closeDrawer} hasSession={hasSession} />
      {showBubble && <ChatBubble />}
    </div>
  );
}
