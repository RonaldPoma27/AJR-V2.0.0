import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getToken, useMe } from "@/api/auth";
import ChatBubble from "@/components/support/ChatBubble";
import AuroraBackground from "./AuroraBackground";
import LanguageSwitch from "./LanguageSwitch";
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
 * Marco inmersivo de todo el sitio (v3.5 Hercules).
 * - Escritorio: Sidebar FLOTANTE colapsable a la izquierda; sin header fijo, el contenido ocupa
 *   toda la pantalla y solo reserva `--rail-w` (ver `.ajr-shell` en index.css).
 * - Móvil/tablet: botón flotante que abre el cajón existente (mismo contenido de navegación).
 * - Cada ruta se remonta con `key` y entra con la animación `ajr-route-in` (respeta reduced-motion).
 * - Con sesión: burbuja de chat de soporte, salvo en /cuenta/soporte (ya es pantalla completa).
 */
export default function AppLayout() {
  const { t } = useTranslation();
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
  const isPublicVisualRoute = !pathname.startsWith("/admin") && !pathname.startsWith("/cuenta");

  return (
    <div className="ajr-app-shell ajr-shell relative isolate flex min-h-screen flex-col" data-rail={collapsed ? "collapsed" : "expanded"}>
      <AuroraBackground />
      <FloatingSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} hasSession={hasSession} />

      <button
        id="ajr-sidebar-trigger"
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={t("nav.openMenu")}
        aria-expanded={drawerOpen}
        aria-controls="sidebar-drawer"
        className="ajr-glass fixed left-3 top-3 z-40 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="fixed right-3 top-3 z-40 lg:hidden"><LanguageSwitch /></div>
      <div className="ajr-scroll-progress" aria-hidden="true" />

      <div className="ajr-shell-body flex min-w-0 flex-1 flex-col">
        <main
          key={pathname}
          className={`app-main relative flex-1 pt-16 lg:pt-0 ${isPublicVisualRoute ? "ajr-public-route" : ""} ${pathname === "/" ? "ajr-home-route" : "ajr-internal-route"}`}
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
