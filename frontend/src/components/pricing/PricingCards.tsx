import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PLAN_PRICE_USD, PLAN_SLUGS, type PlanSlug } from "@/lib/plans";

const FEATURES = ["f1", "f2", "f3"] as const;

/**
 * Tres planes con estética "premium": paneles de vidrio sobre el fondo aurora (en oscuro, azul
 * profundo; en claro, blanco translúcido). Al pasar el mouse —o al enfocar con teclado— la tarjeta
 * sube y se ilumina con un anillo índigo. "Solicitar" lleva a /solicitar-proyecto con el plan en la
 * URL (?plan=…) y en el estado del router; esa ruta está protegida, así que sin sesión pasa por
 * /login y vuelve con el plan intacto (ver ProtectedRoute).
 */
export default function PricingCards() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pricing-title">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="pricing-title" className="text-2xl font-semibold text-fg">
          {t("pricing.title")}
        </h2>
        <p className="mt-3 text-fg-muted">{t("pricing.subtitle")}</p>
      </div>

      <ul role="list" className="mt-10 grid gap-6 md:grid-cols-3">
        {PLAN_SLUGS.map((slug) => (
          <PlanCard key={slug} slug={slug} />
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-fg-subtle">{t("pricing.note")}</p>
    </section>
  );
}

function PlanCard({ slug }: { slug: PlanSlug }) {
  const { t } = useTranslation();
  const name = t(`pricing.plans.${slug}.name`);
  return (
    <li
      className={
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface/60 p-6 shadow-lg shadow-black/5 backdrop-blur-xl " +
        "ring-0 ring-indigo-500/0 transition duration-300 ease-out " +
        "hover:-translate-y-2 hover:ring-2 hover:ring-indigo-500/50 " +
        "focus-within:-translate-y-2 focus-within:ring-2 focus-within:ring-indigo-500/50 " +
        "motion-reduce:transform-none motion-reduce:transition-none"
      }
    >
      {/* Resplandor sutil que sube desde el borde superior: da el aspecto de vidrio iluminado. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex flex-1 flex-col">
        <h3 className="text-lg font-semibold text-fg">{name}</h3>
        <p className="mt-1 min-h-[2.75rem] text-sm text-fg-muted">{t(`pricing.plans.${slug}.tagline`)}</p>

        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="text-sm text-fg-subtle">{t("pricing.from")}</span>
          <span className="text-4xl font-bold tracking-tight text-fg">
            {t("pricing.price", { amount: PLAN_PRICE_USD[slug] })}
          </span>
        </p>

        <ul role="list" className="mt-6 flex-1 space-y-3 text-sm text-fg-muted">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} aria-hidden />
              <span>{t(`pricing.plans.${slug}.${f}`)}</span>
            </li>
          ))}
        </ul>

        <Link
          viewTransition
          to={{ pathname: "/solicitar-proyecto", search: `?plan=${slug}` }}
          state={{ plan: slug }}
          aria-label={t("pricing.requestAria", { plan: name })}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {t("pricing.request")}
        </Link>
      </div>
    </li>
  );
}
