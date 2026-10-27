import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type PricingPlan = {
  id: string;
  key: "presence" | "management" | "custom";
  price: string;
  features: string[];
  featured?: boolean;
};

const plans: PricingPlan[] = [
  {
    id: "presencia-digital",
    key: "presence",
    price: "USD 100",
    features: ["website", "responsive", "contact"],
  },
  {
    id: "web-gestion",
    key: "management",
    price: "USD 250",
    features: ["presence", "forms", "launch"],
    featured: true,
  },
  {
    id: "sistema-medida",
    key: "custom",
    price: "USD 450",
    features: ["analysis", "customFeatures", "implementation"],
  },
];

export default function PricingCards() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pricing-title" className="mt-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">{t("pubHome.pricingEyebrow")}</p>
        <h2 id="pricing-title" className="mt-3 text-3xl font-bold text-fg sm:text-4xl">{t("pubHome.pricingTitle")}</h2>
        <p className="mt-3 text-fg-muted">{t("pubHome.pricingIntro")}</p>
      </div>
      <div className="mt-9 grid items-stretch gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`group relative flex flex-col rounded-2xl border bg-surface/80 p-6 shadow-xl backdrop-blur transition duration-300 hover:-translate-y-2 hover:ring-2 hover:ring-indigo-500/50 ${plan.featured ? "border-indigo-400/60 shadow-indigo-950/10 dark:border-indigo-400/50" : "border-line"}`}
          >
            {plan.featured && <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">{t("pubHome.popularPlan")}</span>}
            <h3 className="text-xl font-semibold text-fg">{t(`pubHome.pricingPlans.${plan.key}.name`)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{t(`pubHome.pricingPlans.${plan.key}.description`)}</p>
            <p className="mt-6"><span className="text-sm text-fg-subtle">{t("pubHome.startingAt")}</span><span className="ml-2 text-3xl font-bold tracking-tight text-fg">{plan.price}</span></p>
            <ul className="mt-6 flex-1 space-y-3 border-t border-line pt-5">
              {plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm text-fg-muted"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />{t(`pubHome.pricingFeatures.${feature}`)}</li>)}
            </ul>
            <Link
              to={`/solicitar-proyecto?plan=${plan.id}`}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-offset-4"
            >
              {t("pubHome.requestPlan")} <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
