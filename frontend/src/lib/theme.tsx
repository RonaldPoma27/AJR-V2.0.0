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

/**
 * Duración (ms) de la transición entre modo claro y oscuro. Tiene que coincidir con
 * `--theme-ms` en index.css. Durante ese tiempo el interruptor queda deshabilitado
 * (`isAnimating`) para que clics rápidos no encadenen cambios a mitad de la animación.
 */
export const THEME_TRANSITION_MS = 1000;
/** Con "reducir movimiento" no hay fundido: solo una pausa corta contra clics repetidos. */
const REDUCED_MOTION_LOCK_MS = 150;

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  /** true mientras dura la transición: el ThemeToggle se deshabilita. */
  isAnimating: boolean;
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

  const [isAnimating, setIsAnimating] = useState(false);
  const animatingRef = useRef(false);
  const timer = useRef<number>();

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      document.documentElement.classList.remove("theme-transition");
    },
    []
  );

  const toggle = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setIsAnimating(true);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    // La clase se agrega ANTES de cambiar `dark`, así los colores arrancan ya con transición.
    if (!reduce) root.classList.add("theme-transition");
    setTheme((t) => (t === "dark" ? "light" : "dark"));

    timer.current = window.setTimeout(
      () => {
        root.classList.remove("theme-transition");
        animatingRef.current = false;
        setIsAnimating(false);
      },
      reduce ? REDUCED_MOTION_LOCK_MS : THEME_TRANSITION_MS + 50
    );
  }, []);
  const value = useMemo(() => ({ theme, toggle, isAnimating }), [theme, toggle, isAnimating]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
