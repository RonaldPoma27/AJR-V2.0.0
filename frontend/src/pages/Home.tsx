import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { usePartners } from "@/api/partners";
import PricingCards from "@/components/PricingCards";
import Reveal from "@/components/ui/Reveal";
import Accordion from "@/components/ui/Accordion";
import type { AccordionItem } from "@/components/ui/Accordion";

export default function Home() {
  const { t } = useTranslation();
  const { data: partners } = usePartners();

  // FAQ items desde i18n
  const faqItems: AccordionItem[] = (t("faq.items", { returnObjects: true }) as Array<{
    id: string;
    title: string;
    content: string;
  }>) || [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-4xl font-bold text-fg">
          {t("pubHome.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-fg-muted">
          {t("pubHome.intro")}
        </p>
        <Link viewTransition
          to="/solicitar-proyecto"
          className="btn-cta mt-8 inline-block rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
        >
          {t("pubHome.cta")}
        </Link>
      </section>

      {/* Planes */}
      <div className="mt-24">
        <PricingCards />
      </div>

      {/* Acerca de */}
      <Reveal className="mt-24">
        <section>
          <h2 className="text-center text-2xl font-semibold text-fg">
            {t("pubHome.aboutTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-fg-muted">
            {t("pubHome.aboutText")}
          </p>
        </section>
      </Reveal>

      {/* Partners */}
      {partners && partners.length > 0 && (
        <Reveal className="mt-20" delay={100}><section>
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
        </section></Reveal>
      )}

      {/* FAQ */}
      {faqItems.length > 0 && (
        <Reveal className="mt-24">
          <Accordion
            items={faqItems}
            title={t("faq.title")}
            subtitle={t("faq.subtitle")}
          />
        </Reveal>
      )}

      {/* CTA de cierre */}
      <Reveal className="mt-24">
        <section className="rounded-lg bg-surface p-8 text-center">
          <h2 className="text-2xl font-semibold text-fg">
            {t("pubHome.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-fg-muted">
            {t("pubHome.intro")}
          </p>
          <Link viewTransition
            to="/solicitar-proyecto"
            className="btn-cta mt-6 inline-block rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
          >
            {t("pubHome.cta")}
          </Link>
        </section>
      </Reveal>
    </div>
  );
}
