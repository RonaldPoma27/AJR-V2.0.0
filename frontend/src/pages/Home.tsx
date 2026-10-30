import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Code2, Database, Workflow, Zap } from "lucide-react";
import { usePartners } from "@/api/partners";
import PricingCards from "@/components/ui/PricingCards";

export default function Home() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const faqItems = ["scope", "custom", "pricing", "communication", "hosting"] as const;
  const processSteps = ["listen", "define", "build", "deliver"] as const;
  const { data: partners } = usePartners();

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

      <section className="ajr-home-section ajr-home-about mt-14 sm:mt-20" aria-labelledby="about-title">
        <div className="ajr-section-marker" aria-hidden="true">01 <span /></div>
        <div className="ajr-about-content">
          <p className="ajr-section-eyebrow">{t("pubHome.aboutEyebrow")}</p>
          <h2 id="about-title" className="ajr-section-title">{t("pubHome.aboutTitle")}</h2>
          <p className="ajr-section-copy">{t("pubHome.aboutText")}</p>
        </div>
        <div className="ajr-about-accent" aria-hidden="true">
          <span className="ajr-about-accent-line" />
          <span className="ajr-about-accent-dot" />
          <span className="ajr-about-accent-ring" />
        </div>
      </section>

      <section className="ajr-process-section mt-16 sm:mt-20" aria-labelledby="process-title">
        <div className="ajr-section-heading">
          <p className="ajr-section-eyebrow">{t("pubHome.process.eyebrow")}</p>
          <h2 id="process-title" className="ajr-section-title">{t("pubHome.process.title")}</h2>
          <p className="ajr-section-copy">{t("pubHome.process.intro")}</p>
        </div>
        <ol className="ajr-process-grid">
          {processSteps.map((step, index) => (
            <li key={step} className="ajr-process-card">
              <div className="ajr-process-card-top">
                <span className="ajr-process-number">0{index + 1}</span>
                <span className="ajr-process-line" aria-hidden="true" />
              </div>
              <h3>{t(`pubHome.process.steps.${step}.title`)}</h3>
              <p>{t(`pubHome.process.steps.${step}.description`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="ajr-home-services">
        <PricingCards />
      </div>

      <section className="ajr-home-faq mt-16 sm:mt-20" aria-labelledby="faq-title">
        <div className="ajr-section-heading ajr-section-heading--center">
          <p className="ajr-section-eyebrow">{t("pubHome.faq.eyebrow")}</p>
          <h2 id="faq-title" className="ajr-section-title">{t("pubHome.faq.title")}</h2>
          <p className="ajr-section-copy">{t("pubHome.faq.intro")}</p>
        </div>
        <div className="ajr-faq-list">
          {faqItems.map((item) => {
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
                    onClick={() => setOpenFaq((current) => current === item ? null : item)}
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
      </section>

      {partners && partners.length > 0 && (
        <section className="ajr-home-section ajr-home-partners mt-16 sm:mt-20" aria-labelledby="partners-title">
          <div className="ajr-partners-heading">
            <p className="ajr-section-eyebrow">{t("pubHome.partnersEyebrow")}</p>
            <h2 id="partners-title" className="ajr-section-title">{t("pubHome.partnersTitle")}</h2>
          </div>
          <div className="ajr-partner-list">
            {partners.map((p) => (
              <div key={p.id} className="ajr-partner-item">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} loading="lazy" />
                ) : (
                  <span>{p.name}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
