import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { usePartners } from "@/api/partners";
import PricingCards from "@/components/ui/PricingCards";

export default function Home() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const faqItems = ["scope", "custom", "pricing", "communication", "hosting"] as const;
  const { data: partners } = usePartners();

  return (
    <div className="ajr-home mx-auto max-w-6xl px-6 py-16">
      <section className="ajr-home-hero text-center">
        <h1 className="text-4xl font-bold text-fg">
          {t("pubHome.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-fg-muted">
          {t("pubHome.intro")}
        </p>
        <Link
          to="/solicitar-proyecto"
          className="mt-8 inline-block rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
        >
          {t("pubHome.cta")}
        </Link>
      </section>

      <section className="ajr-home-section mt-20">
        <h2 className="text-center text-2xl font-semibold text-fg">
          {t("pubHome.aboutTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-fg-muted">
          {t("pubHome.aboutText")}
        </p>
      </section>

      <PricingCards />

      <section className="mt-16" aria-labelledby="faq-title">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">{t("pubHome.faq.eyebrow")}</p>
          <h2 id="faq-title" className="mt-3 text-3xl font-bold text-white sm:text-4xl">{t("pubHome.faq.title")}</h2>
          <p className="mt-3 text-white">{t("pubHome.faq.intro")}</p>
        </div>
        <div className="mx-auto max-w-3xl space-y-3">
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
        <section className="ajr-home-section ajr-home-partners mt-20">
          <h2 className="text-center text-2xl font-semibold text-fg">
            {t("pubHome.partnersTitle")}
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-10">
            {partners.map((p) => (
              <div key={p.id} className="text-center text-fg-subtle">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="h-10" />
                ) : (
                  <span className="font-medium">{p.name}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
