import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router-dom";
import { getToken, useLogout, useMe, type UserRole } from "@/api/auth";
import { saveReturnUrl } from "@/lib/returnUrl";

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center p-12 text-center">{children}</div>;
}

/**
 * Redirige a /login recordando a dónde quería ir la persona: ruta + query (por ejemplo
 * `/solicitar-proyecto?plan=web-gestion`), en el estado del router (`state.from`) y en localStorage
 * (`returnUrl`, por si recarga o pasa por "Registrarse"). Tras autenticarse, Login/Register vuelven ahí.
 */
function RedirectToLogin({ from }: { from: string }) {
  saveReturnUrl(from); // idempotente: puede ejecutarse más de una vez sin efectos secundarios
  return <Navigate to="/login" replace state={{ from }} />;
}

/**
 * Exige sesión válida y, si se pasa `roles`, que el rol esté en la lista.
 * (El backend vuelve a validar todo: esto solo evita mostrar pantallas que van a fallar.)
 */
export default function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const logout = useLogout();
  const { data: me, isLoading, isError, error, refetch } = useMe();

  const from = location.pathname + location.search;

  if (!getToken()) {
    return <RedirectToLogin from={from} />;
  }
  if (isLoading) {
    return <Message><p className="text-fg-subtle">{t("guard.verifying")}</p></Message>;
  }
  if (isError) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return <RedirectToLogin from={from} />;
    }
    return (
      <Message>
        <div>
          <p className="text-fg-muted">{t("guard.verifyFailed")}</p>
          <button
            onClick={() => refetch()}
            className="btn-cta mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {t("guard.retry")}
          </button>
        </div>
      </Message>
    );
  }
  if (roles && (!me || !roles.includes(me.role))) {
    return (
      <Message>
        <div>
          <p className="text-fg-muted">{t("guard.forbidden")}</p>
          <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
            <Link viewTransition to="/cuenta" className="text-accent hover:underline">{t("guard.goAccount")}</Link>
            <button onClick={logout} className="text-accent hover:underline">{t("guard.logout")}</button>
          </div>
        </div>
      </Message>
    );
  }
  return <>{children}</>;
}
