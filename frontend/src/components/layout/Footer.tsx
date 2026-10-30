import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/10 bg-[#0B0F19] py-6 text-center text-sm text-white">
      <p>{t("footer.line", { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
