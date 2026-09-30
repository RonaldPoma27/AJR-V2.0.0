import { isAxiosError } from "axios";
import { Navigate, useLocation } from "react-router-dom";
import { getToken, useLogout, useMe } from "@/api/auth";

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center">{children}</div>;
}

/** Protege /admin/*: exige sesión válida y rol ADMIN (el backend lo vuelve a validar igual). */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const logout = useLogout();
  const { data: me, isLoading, isError, error, refetch } = useMe();

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isLoading) {
    return <Message><p className="text-gray-500">Verificando tu sesión…</p></Message>;
  }
  if (isError) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
    return (
      <Message>
        <div>
          <p className="text-gray-700">No pudimos verificar tu sesión. Puede ser un problema de conexión.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Reintentar
          </button>
        </div>
      </Message>
    );
  }
  if (me?.role !== "ADMIN") {
    return (
      <Message>
        <div>
          <p className="text-gray-700">Tu cuenta no tiene permisos para entrar al panel.</p>
          <button onClick={logout} className="mt-4 text-sm font-medium text-brand hover:underline">
            Cerrar sesión
          </button>
        </div>
      </Message>
    );
  }
  return <>{children}</>;
}
