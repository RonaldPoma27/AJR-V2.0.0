import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Code2, Database, Workflow, Zap } from "lucide-react";
import { usePartners } from "@/api/partners";
import { BentoCard, BentoGrid } from "@/components/ui/Bento";
import CountUp from "@/components/ui/CountUp";
import PricingCards from "@/components/ui/PricingCards";

const FAQ_ITEMS = ["scope", "custom", "pricing", "communication", "hosting"] as const;
const PROCESS_STEPS = ["listen", "define", "build", "deliver"] as const;

export default function Home() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { data: partners } = usePartners();
  const partnerCount = partners?.length ?? 0;

  return (
    <div className="ajr-home mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <section className="ajr-home-hero" aria-labelledby="home-title">
        <div className="ajr-home-hero-grid">
          <div className="ajr-home-hero-copy">
            <div className="ajr-home-eyebrow">
              <span className="ajr-status-pulse" aria-hidden="true" />
              {t("pubHome.eyebrow")}
            </div>
            <h1 id="home-title" className="ajr-home-title">
              <Trans i18nKey="pubHome.title" components={{ 1: <span className="ajr-text-accent" /> }} />
            </h1>
            <p className="ajr-home-intro">{t("pubHome.intro")}</p>
            <div className="ajr-home-actions">
              <Link to="/solicitar-proyecto" className="ajr-gradient-button ajr-home-primary">
                {t("pubHome.cta")} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/portfolio" className="ajr-home-secondary">
                {t("pubHome.portfolioCta")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="ajr-home-proofline">
              <span className="ajr-proofline-mark" aria-hidden="true"><Code2 className="h-4 w-4" /></span>
              <span>{t("pubHome.heroNote")}</span>
            </div>
          </div>

          <div className="ajr-hero-visual" aria-hidden="true">
            <div className="ajr-hero-visual-shell">
              <div className="ajr-hero-grid-lines" />
              <div className="ajr-hero-glow ajr-hero-glow--cyan" />
              <div className="ajr-hero-glow ajr-hero-glow--violet" />
              <div className="ajr-hero-orbit ajr-hero-orbit--outer" />
              <div className="ajr-hero-orbit ajr-hero-orbit--inner" />
              <div className="ajr-hero-orbit-dot ajr-hero-orbit-dot--one" />
              <div className="ajr-hero-orbit-dot ajr-hero-orbit-dot--two" />
              <div className="ajr-hero-core">
                <span className="ajr-hero-core-mark"><Code2 className="h-8 w-8" /></span>
                <span className="ajr-hero-core-name">AJR</span>
                <span className="ajr-hero-core-label">DATA</span>
              </div>
              <div className="ajr-hero-node ajr-hero-node--data"><Database className="h-5 w-5" /></div>
              <div className="ajr-hero-node ajr-hero-node--flow"><Workflow className="h-5 w-5" /></div>
              <div className="ajr-hero-node ajr-hero-node--energy"><Zap className="h-5 w-5" /></div>
              <span className="ajr-hero-connector ajr-hero-connector--one" />
              <span className="ajr-hero-connector ajr-hero-connector--two" />
              <span className="ajr-hero-connector ajr-hero-connector--three" />
              <div className="ajr-hero-corner-label ajr-hero-corner-label--top">SYSTEMS / DATA / DESIGN</div>
              <div className="ajr-hero-corner-label ajr-hero-corner-label--bottom">ENGINEERED AROUND YOUR NEEDS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Métricas: cifras reales (socios cargados, etapas del proceso, preguntas frecuentes). */}
      <BentoGrid className="mt-14 sm:mt-20" aria-label={t("pubHome.metrics.label")}>
        {partnerCount > 0 && (
          <BentoCard cols={2} accent="cyan" className="flex flex-col gap-3 p-6 sm:p-7">
            <span className="ajr-meta">{t("pubHome.metrics.partners")}</span>
            <CountUp value={partnerCount} className="ajr-metric-value" />
          </BentoCard>
        )}
        <BentoCard cols={2} accent="violet" className="flex flex-col gap-3 p-6 sm:p-7">
          <span className="ajr-meta">{t("pubHome.metrics.steps")}</span>
          <CountUp value={PROCESS_STEPS.length} className="ajr-metric-value" />
        </BentoCard>
        <BentoCard cols={2} accent="blue" className="flex flex-col gap-3 p-6 sm:p-7">
          <span className="ajr-meta">{t("pubHome.metrics.questions")}</span>
          <CountUp value={FAQ_ITEMS.length} className="ajr-metric-value" />
        </BentoCard>
      </BentoGrid>

      {/* Bento 1: quiénes somos + proceso */}
      <BentoGrid className="mt-6" aria-label={t("pubHome.aboutTitle")}>
        <BentoCard as="section" cols={4} rows={2} accent="cyan" aria-labelledby="about-title" className="flex flex-col justify-center p-7 sm:p-10">
          <p className="ajr-section-eyebrow">{t("pubHome.aboutEyebrow")}</p>
          <h2 id="about-title" className="ajr-section-title">{t("pubHome.aboutTitle")}</h2>
          <p className="ajr-section-copy">{t("pubHome.aboutText")}</p>
        </BentoCard>
        {PROCESS_STEPS.map((step, index) => (
          <BentoCard key={step} as="article" cols={index < 2 ? 2 : 3} accent={index % 2 ? "violet" : "blue"}>
            <span className="ajr-process-number">0{index + 1}</span>
            <h3 className="mt-2 text-lg font-semibold text-fg">{t(`pubHome.process.steps.${step}.title`)}</h3>
            <p className="mt-1.5 text-sm text-fg-muted">{t(`pubHome.process.steps.${step}.description`)}</p>
          </BentoCard>
        ))}
      </BentoGrid>

      <div className="ajr-home-services">
        <PricingCards />
      </div>

      {/* Bento 2: FAQ + llamado a la acción + socios */}
      <BentoGrid className="mt-16 sm:mt-20">
        <BentoCard as="section" cols={4} rows={2} accent="blue" aria-labelledby="faq-title" className="p-6 sm:p-8">
          <p className="ajr-section-eyebrow">{t("pubHome.faq.eyebrow")}</p>
          <h2 id="faq-title" className="ajr-section-title">{t("pubHome.faq.title")}</h2>
          <p className="ajr-section-copy">{t("pubHome.faq.intro")}</p>
          <div className="ajr-faq-list mt-5">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openFaq === item;
              const triggerId = `faq-trigger-${item}`;
              const panelId = `faq-panel-${item}`;
              return (
                <article key={item} className="ajr-faq-item" data-open={isOpen}>
                  <h3>
                    <button
                      id={triggerId}
                      type="button"
                      className="ajr-faq-trigger focus-visible:outline-offset-[-4px]"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq((current) => (current === item ? null : item))}
                    >
                      <span className="font-semibold">{t(`pubHome.faq.items.${item}.question`)}</span>
                      <span className="ajr-faq-icon" aria-hidden="true" />
                    </button>
                  </h3>
                  <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!isOpen}>
                    <p className="ajr-faq-answer">{t(`pubHome.faq.items.${item}.answer`)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </BentoCard>

        <BentoCard cols={2} accent="violet" className="flex flex-col items-start justify-center gap-4">
          <p className="text-lg font-semibold text-fg">{t("pubHome.heroNote")}</p>
          <Link to="/solicitar-proyecto" className="ajr-gradient-button ajr-home-primary">
            {t("pubHome.cta")} <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </BentoCard>

        {partnerCount > 0 && (
          <BentoCard as="section" cols={2} accent="cyan" aria-labelledby="partners-title">
            <p className="ajr-section-eyebrow">{t("pubHome.partnersEyebrow")}</p>
            <h2 id="partners-title" className="ajr-section-title !text-2xl">{t("pubHome.partnersTitle")}</h2>
            <div className="ajr-partner-list mt-4">
              {partners?.map((p) => (
                <div key={p.id} className="ajr-partner-item">
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" /> : <span>{p.name}</span>}
                </div>
              ))}
            </div>
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}
```[cite: 14]

---

### 3. `app/src/components/ui/Bento.tsx`
*Código completo del componente Bento (se mantiene intacto ya que estructura las tarjetas y no afecta directamente al botón)[cite: 16]:*

```tsx
import { useCallback, type CSSProperties, type ElementType, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sistema Bento: grilla asimétrica de 6 columnas (desktop), 2 (tablet) y 1 (móvil).
 * Cada tarjeta declara su tamaño con `cols` y `rows`; la grilla las encastra (`grid-flow-dense`).
 * El brillo sigue al puntero: `--mx` / `--my` se actualizan en cada movimiento y los consume el CSS
 * (`.ajr-bento-card::before` para el interior y `::after` para el borde).
 */
export type BentoSpan = 1 | 2 | 3 | 4 | 5 | 6;
export type BentoRows = 1 | 2 | 3;
export type BentoAccent = "cyan" | "violet" | "blue";

// Clases completas y estáticas: Tailwind no detecta nombres armados con template strings.
const COLS: Record<BentoSpan, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
};
const TABLET_COLS: Record<BentoSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-1",
  3: "md:col-span-1",
  4: "md:col-span-2",
  5: "md:col-span-2",
  6: "md:col-span-2",
};
const ROWS: Record<BentoRows, string> = {
  1: "",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
};

export function BentoGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ajr-bento-grid", className)} {...rest} />;
}

interface BentoCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: ElementType;
  cols?: BentoSpan;
  rows?: BentoRows;
  accent?: BentoAccent;
  /** Animación de aparición ligada al scroll (CSS `animation-timeline: view()`). */
  scrollReveal?: boolean;
  children: ReactNode;
}

export function BentoCard({
  as: Tag = "div",
  cols = 2,
  rows = 1,
  accent = "cyan",
  scrollReveal = true,
  className,
  children,
  onPointerMove,
  ...rest
}: BentoCardProps) {
  const handleMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
      onPointerMove?.(event);
    },
    [onPointerMove]
  );

  return (
    <Tag
      data-accent={accent}
      onPointerMove={handleMove}
      style={{ "--mx": "50%", "--my": "0%" } as CSSProperties}
      className={cn(
        "ajr-bento-card md:col-span-1",
        TABLET_COLS[cols],
        COLS[cols],
        ROWS[rows],
        scrollReveal && "ajr-scroll-reveal",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```[cite: 16]
