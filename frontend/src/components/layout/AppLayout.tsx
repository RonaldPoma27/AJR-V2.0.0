import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken, useMe } from "@/api/auth";
import ChatBubble from "@/components/support/ChatBubble";
import ReactiveBackground from "./ReactiveBackground";
import PortfolioAtmosphere from "./PortfolioAtmosphere";
import NavBar from "./NavBar";
import FloatingSidebar from "./FloatingSidebar";
import Footer from "./Footer";
import { SidebarDrawer } from "./Sidebar";

const RAIL_KEY = "ajrdata_rail_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    return false; // storage bloqueado: arrancamos expandido
  }
}

/**
 * Marco inmersivo de todo el sitio (v3.6 Haniel).
 * - Escritorio: Sidebar FLOTANTE colapsable a la izquierda; sin header fijo, el contenido ocupa
 *   toda la pantalla y solo reserva `--rail-w` (ver `.ajr-shell` en index.css).
 * - Móvil/tablet: navbar compacta con identidad AJR, idioma y acceso al drawer flotante existente.
 * - Cada ruta se remonta con `key` y entra con la animación `ajr-route-in` (respeta reduced-motion).
 * - Con sesión: burbuja de chat de soporte, salvo en /cuenta/soporte (ya es pantalla completa).
 */
export default function AppLayout() {
  const hasSession = Boolean(getToken());
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
    } catch {
      /* preferencia no persistida: no es crítica */
    }
  }, [collapsed]);

  // Cada navegación arranca arriba (evita heredar el scroll de la ruta anterior).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const showBubble = Boolean(me) && !pathname.startsWith("/cuenta/soporte");
  const isPortfolioRoute = pathname === "/portfolio" || pathname.startsWith("/portfolio/");
  const isPublicVisualRoute = !pathname.startsWith("/admin") && !pathname.startsWith("/cuenta");

  return (
    <div className="ajr-app-shell ajr-shell relative isolate flex min-h-screen flex-col" data-rail={collapsed ? "collapsed" : "expanded"} data-portfolio-route={isPortfolioRoute ? "true" : undefined}>
      {isPortfolioRoute ? <PortfolioAtmosphere /> : <ReactiveBackground />}
      <FloatingSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} hasSession={hasSession} />

      <div className="ajr-mobile-topbar-wrap fixed inset-x-3 top-3 z-40 lg:hidden">
        <NavBar sidebarOpen={drawerOpen} onToggleSidebar={() => setDrawerOpen((value) => !value)} />
      </div>
      <div className="ajr-scroll-progress" aria-hidden="true" />

      <div className={`ajr-shell-body relative z-10 flex min-w-0 flex-1 flex-col ${isPortfolioRoute ? "ajr-shell-body--portfolio" : ""}`}>
        <main
          key={pathname}
          className={`app-main relative flex-1 pt-20 lg:pt-0 ${isPublicVisualRoute ? "ajr-public-route" : ""} ${pathname === "/" ? "ajr-home-route" : "ajr-internal-route"}`}
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
