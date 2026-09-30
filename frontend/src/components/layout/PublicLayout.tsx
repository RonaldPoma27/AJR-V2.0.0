import { Outlet } from "react-router-dom";
import NavBar from "./NavBar";
import Footer from "./Footer";

/** Marco del sitio público: NavBar + contenido + Footer. */
export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
