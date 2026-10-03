import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

export type Language = "es" | "en";
export const LANGUAGE_STORAGE_KEY = "ajrdata_lang";

function readInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* localStorage bloqueado: seguimos con el idioma del navegador */
  }
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: readInitialLanguage(),
  fallbackLng: "es",
  interpolation: { escapeValue: false }, // React ya escapa
});

// Mantiene <html lang> y la preferencia guardada sincronizados con el idioma activo.
function syncLanguage(lng: string) {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* ignorar */
  }
}
syncLanguage(i18n.language);
i18n.on("languageChanged", syncLanguage);

export default i18n;
