import { createContext, useContext, useEffect } from "react";

export const THEME_LOCK_MS = 1000;

interface ThemeContextValue {
  theme: "dark";
  toggle: () => void;
  locked: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Tema oscuro permanente. Hydra 3.0 elimina soporte para tema claro. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Asegurar que la clase 'dark' esté en html desde el inicio
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Valor inmutable: siempre dark, toggle no hace nada, nunca locked
  const value: ThemeContextValue = {
    theme: "dark",
    toggle: () => {}, // no-op
    locked: false,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
