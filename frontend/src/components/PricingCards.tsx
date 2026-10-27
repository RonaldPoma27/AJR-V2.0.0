import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Reveal from "@/components/ui/Reveal";
import { PLAN_KEYS, PLAN_PRICE_USD, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/utils";

const FEATURES = ["f1", "f2", "f3"] as const;
const POPULAR: PlanKey = "web-gestion";

/**
 * Tres planes con estética "premium": fondos sólidos oscuros (claros en modo claro), borde que se
 * ilumina y elevación al pasar el cursor. "Solicitar" lleva a /solicitar-proyecto con el plan elegido
 * (en la URL y en el estado del router); si no hay sesión, ProtectedRoute manda a /login y luego vuelve.
 */
export default function PricingCards() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pricing-title">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t("pricing.eyebrow")}</p>
        <h2 id="pricing-title" className="mt-2 text-3xl font-bold text-fg">
          {t("pricing.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-fg-muted">{t("pricing.subtitle")}</p>
      </div>

      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {PLAN_KEYS.map((key, index) => {
          const popular = key === POPULAR;
          return (
            <li key={key} className="flex">
              <Reveal delay={index * 120} className="flex w-full">
                <article
                  className={cn(
                    "relative flex w-full flex-col rounded-2xl border bg-surface p-7 shadow-sm transition-all duration-300",
                    "hover:-translate-y-2 hover:shadow-xl hover:ring-2 hover:ring-indigo-500/50 focus-within:-translate-y-2 focus-within:ring-2 focus-within:ring-indigo-500/50",
                    "dark:bg-slate-900",
                    popular && "border-indigo-400 dark:border-indigo-500"
                  )}
                >
                  {popular && (
                    <span className="absolute -top-3 left-7 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                      {t("pricing.popular")}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-fg">{t(`pricing.plans.${key}.name`)}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{t(`pricing.plans.${key}.tagline`)}</p>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-sm text-fg-subtle">{t("pricing.from")}</span>
                    <span className="text-xs font-semibold text-fg-subtle">{t("pricing.currency")}</span>
                    <span className="text-4xl font-bold tracking-tight text-fg">{PLAN_PRICE_USD[key]}</span>
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-fg-muted">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" strokeWidth={2} aria-hidden />
                        {t(`pricing.plans.${key}.${f}`)}
                      </li>
                    ))}
                  </ul>

                  <Link
                    viewTransition
                    to={`/solicitar-proyecto?plan=${key}`}
                    state={{ plan: key }}
                    className="btn-cta mt-8 inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                  >
                    {t("pricing.cta")}
                  </Link>
                </article>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
