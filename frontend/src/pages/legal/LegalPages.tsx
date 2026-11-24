import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import Markdown from "@/components/ui/Markdown";
import { BentoCard, BentoGrid } from "@/components/ui/Bento";
import privacyEs from "@/content/legal/privacy.es.md?raw";
import termsEs from "@/content/legal/terms.es.md?raw";
import eulaEs from "@/content/legal/eula.es.md?raw";

type DocKey = "privacy" | "terms" | "eula";

// Los documentos legales son fuente única en español (rigen por ley argentina).
const SOURCES: Record<DocKey, string> = { privacy: privacyEs, terms: termsEs, eula: eulaEs };

/** Vista común de los textos legales: Bento de 2 tarjetas (cabecera + documento). */
function LegalPage({ doc }: { doc: DocKey }) {
  const { t, i18n } = useTranslation();
  const showNotice = i18n.resolvedLanguage === "en";
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
      <BentoGrid>
        <BentoCard cols={6} accent="violet" scrollReveal={false}>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t("legalPages.back")}
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{t("legalPages.updated")}</p>
          <p className="mt-2 text-fg-muted">{t(`legalPages.${doc}.meta`)}</p>
          {showNotice && <p role="note" className="mt-3 rounded-md border border-cyan-300/30 bg-cyan-400/10 p-3 text-sm text-fg-muted">{t("legalPages.onlySpanish")}</p>}
        </BentoCard>
        <BentoCard as="article" cols={6} accent="blue" className="p-6 sm:p-9" lang="es">
          <Markdown source={SOURCES[doc]} className="ajr-prose" />
        </BentoCard>
      </BentoGrid>
    </div>
  );
}

export const PrivacyPage = () => <LegalPage doc="privacy" />;
export const TermsPage = () => <LegalPage doc="terms" />;
export const EulaPage = () => <LegalPage doc="eula" />;
