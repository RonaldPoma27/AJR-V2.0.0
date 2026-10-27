import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-fg">{t("pubNotFound.title")}</h1>
      <p className="mt-2 text-fg-muted">{t("pubNotFound.text")}</p>
      <Link to="/" className="mt-6 inline-block font-medium text-accent hover:underline">
        {t("pubNotFound.home")}
      </Link>
    </div>
  );
}
