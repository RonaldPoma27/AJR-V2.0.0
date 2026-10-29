import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

/**
 * Textos por sección: cada archivo de `parts/` aporta sus propias claves de primer nivel
 * (`parts/orders.es.json` + `parts/orders.en.json`). Se suman a es.json / en.json.
 */
type Dict = Record<string, unknown>;
function mergeParts(base: Dict, modules: Record<string, unknown>): Dict {
  const out: Dict = { ...base };
  for (const [file, mod] of Object.entries(modules)) {
    for (const [key, value] of Object.entries(mod as Dict)) {
      if (key in out) console.warn(`[i18n] clave duplicada "${key}" en ${file}`);
      out[key] = value;
    }
  }
  return out;
}
const esParts = import.meta.glob("./parts/*.es.json", { eager: true, import: "default" });
const enParts = import.meta.glob("./parts/*.en.json", { eager: true, import: "default" });

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
  resources: {
    es: { translation: mergeParts(es, esParts) },
    en: { translation: mergeParts(en, enParts) },
  },
  lng: readInitialLanguage(),
  fallbackLng: "es",
  interpolation: { escapeValue: false }, // React ya escapa
});

/** Locale para fechas y números según el idioma activo. */
export function dateLocale(): string {
  return i18n.resolvedLanguage === "en" ? "en-US" : "es-AR";
}

// Mantiene <html lang> y la preferencia guardada sincronizados con el idioma activo.
function syncLanguage(lng: string) {
  document.documentElement.lang = lng;
  document.title = i18n.t("meta.title");
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* ignorar */
  }
}
syncLanguage(i18n.language);
i18n.on("languageChanged", syncLanguage);

export default i18n;
