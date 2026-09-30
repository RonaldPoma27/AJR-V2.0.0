import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
      <p>© {new Date().getFullYear()} AJR Data — Consultora Tecnológica</p>
      <p className="mt-1">
        <Link to="/login" className="text-xs text-gray-400 hover:text-brand">
          Acceso equipo
        </Link>
      </p>
    </footer>
  );
}
