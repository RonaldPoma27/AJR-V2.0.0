import { Link } from "react-router-dom";
import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Footer global (v3.5). Se adapta al layout inmersivo: es una tarjeta glass dentro del área de
 * contenido, no una barra a todo el ancho.
 *
 * Cumplimiento: el enlace "Botón de arrepentimiento" (Res. 424/2020) es SIEMPRE visible y de acceso
 * directo, con estilo destacado; no depende de sesión, rol ni idioma.
 */
const LEGAL_LINKS = [
  { to: "/privacy", key: "footerNav.privacy" },
  { to: "/terms", key: "footerNav.terms" },
  { to: "/eula", key: "footerNav.eula" },
] as const;

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pb-6 pt-10 sm:px-6 lg:px-8">
      <div className="ajr-glass rounded-2xl px-5 py-5 text-sm text-white">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <nav aria-label={t("footerNav.label")}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map(({ to, key }) => (
                <li key={to}>
                  <Link to={to} className="text-white/85 underline-offset-4 transition hover:text-white hover:underline">
                    {t(key)}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/arrepentimiento" className="ajr-regret-link" title={t("footerNav.regretHint")}>
                  <Undo2 className="h-4 w-4" aria-hidden />
                  {t("footerNav.regret")}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-white/70">{t("footer.line", { year: new Date().getFullYear() })}</p>
        </div>
        <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/55">{t("footerNav.rights")}</p>
      </div>
    </footer>
  );
}
