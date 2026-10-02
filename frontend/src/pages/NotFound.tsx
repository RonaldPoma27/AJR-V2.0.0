import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-fg">Esta página no existe</h1>
      <p className="mt-2 text-fg-muted">Puede que el link esté mal o que la hayamos movido.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-accent hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
