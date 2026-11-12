import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, Scale, ShieldCheck } from "lucide-react";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="ajr-site-footer mt-4 rounded-2xl border border-white/10 bg-[#0b1220]/80 px-5 py-5 text-sm text-slate-300 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="font-semibold tracking-wide text-white">AJR DATA</p>
          <p className="mt-1 text-xs text-slate-400">{t("footer.line", { year: new Date().getFullYear() })}</p>
        </div>
        <nav aria-label="Información legal" className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link to="/privacy" className="inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-cyan-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t("legal.privacy")}</Link>
          <Link to="/terms" className="inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-cyan-200"><Scale className="h-4 w-4" aria-hidden="true" />{t("legal.terms")}</Link>
          <Link to="/eula" className="inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-cyan-200"><FileText className="h-4 w-4" aria-hidden="true" />{t("legal.eula")}</Link>
          <Link to="/arrepentimiento" className="ajr-regret-footer-link inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/15">
            {t("regret.button")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </footer>
  );
}
