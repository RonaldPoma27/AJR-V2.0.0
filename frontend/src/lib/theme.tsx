import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "ajrdata_theme";

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage bloqueado: seguimos con el tema del sistema */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Tiempo (ms) que el interruptor ignora clics tras un cambio: evita parpadeos por clics repetidos. */
export const THEME_LOCK_MS = 650;

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  /** true mientras el interruptor está bloqueado. */
  locked: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Maneja la clase `dark` en <html> (Tailwind `darkMode: ["class"]`) y recuerda la elección. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignorar */
    }
  }, [theme]);

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toggle = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    setTheme((t) => (t === "dark" ? "light" : "dark"));
    timer.current = window.setTimeout(() => {
      lockedRef.current = false;
      setLocked(false);
    }, THEME_LOCK_MS);
  }, []);
  const value = useMemo(() => ({ theme, toggle, locked }), [theme, toggle, locked]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
