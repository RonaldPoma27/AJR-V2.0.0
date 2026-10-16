import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { usePartners } from "@/api/partners";

export default function Home() {
  const { t } = useTranslation();
  const { data: partners } = usePartners();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <section className="text-center">
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

      <section className="mt-20">
        <h2 className="text-center text-2xl font-semibold text-fg">
          {t("pubHome.aboutTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-fg-muted">
          {t("pubHome.aboutText")}
        </p>
      </section>

      {partners && partners.length > 0 && (
        <section className="mt-20">
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
