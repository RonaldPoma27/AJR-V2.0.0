import { useMemo } from "react";
import { Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import Accordion, { type AccordionItem } from "@/components/ui/Accordion";
import { BentoCard, BentoGrid } from "@/components/ui/Bento";

/**
 * Modalidades de contratación (LCT 20.744 y reformas) dentro del sistema Bento + glassmorphism.
 * Los textos viven en i18n (`workLaw.*`): el contenido legal se edita sin tocar el componente
 * (Mantenibilidad/Flexibilidad). Cada modalidad tiene exactamente 3 puntos + su base legal.
 */
const MODALITIES = ["indefinite", "fixed", "eventual", "parttime", "remote", "freelance"] as const;
const POINTS = ["p1", "p2", "p3"] as const;

export default function ContractModalities() {
  const { t, i18n } = useTranslation();

  const items = useMemo<AccordionItem[]>(
    () =>
      MODALITIES.map((key) => ({
        id: key,
        title: t(`workLaw.items.${key}.title`),
        summary: t(`workLaw.items.${key}.summary`),
        content: (
          <>
            <ul className="list-disc space-y-1.5 pl-5">
              {POINTS.map((p) => <li key={p}>{t(`workLaw.items.${key}.${p}`)}</li>)}
            </ul>
            <p className="mt-3 text-xs text-fg-subtle">
              <span className="font-semibold text-accent">{t("workLaw.basis")}: </span>
              {t(`workLaw.items.${key}.law`)}
            </p>
          </>
        ),
      })),
    // i18n.resolvedLanguage fuerza el recálculo al cambiar de idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.resolvedLanguage]
  );

  return (
    <section aria-labelledby="work-law-title" className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
      <BentoGrid>
        <BentoCard cols={6} accent="violet">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
            <Scale className="h-4 w-4" aria-hidden /> {t("workLaw.eyebrow")}
          </p>
          <h2 id="work-law-title" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">{t("workLaw.title")}</h2>
          <p className="mt-3 max-w-3xl text-fg-muted">{t("workLaw.intro")}</p>
        </BentoCard>

        <BentoCard cols={4} rows={2} accent="cyan">
          <Accordion items={items} defaultOpen="indefinite" label={t("workLaw.listLabel")} />
        </BentoCard>

        <BentoCard cols={2} accent="blue">
          <h3 className="font-semibold text-fg">{t("workLaw.processTitle")}</h3>
          <p className="mt-2 text-sm text-fg-muted">{t("workLaw.processText")}</p>
          <a href="#postulacion" className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{t("workLaw.applyCta")}</a>
        </BentoCard>

        <BentoCard cols={2} accent="violet" role="note">
          <h3 className="font-semibold text-fg">{t("workLaw.noteTitle")}</h3>
          <p className="mt-2 text-sm text-fg-muted">{t("workLaw.note")}</p>
        </BentoCard>
      </BentoGrid>
    </section>
  );
}
