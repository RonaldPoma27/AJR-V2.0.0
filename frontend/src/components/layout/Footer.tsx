import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t bg-surface py-6 text-center text-sm text-fg-subtle">
      <p>{t("footer.line", { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
