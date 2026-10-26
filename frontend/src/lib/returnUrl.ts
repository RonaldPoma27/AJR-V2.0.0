/**
 * "A dónde volver después de iniciar sesión".
 *
 * El destino viaja por dos caminos a la vez:
 *  1. El estado del router (`state.from`): rápido, pero se pierde al recargar la página de login.
 *  2. localStorage (`ajrdata_return_url`): respaldo que sobrevive a una recarga, a abrir
 *     "Registrarse" o a que la persona tarde un rato. Caduca a los 30 minutos para que un destino
 *     viejo no sorprenda en un inicio de sesión posterior.
 *
 * Siempre se guarda ruta + query (`/solicitar-proyecto?plan=web-gestion`): así no se pierde la selección.
 */
const KEY = "ajrdata_return_url";
const MAX_AGE_MS = 30 * 60 * 1000;

/** Solo rutas internas del sitio (evita redirecciones abiertas) y nunca las de autenticación. */
export function safeReturnUrl(url?: string | null): string | undefined {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return undefined;
  const path = url.split(/[?#]/)[0];
  if (path === "/login" || path === "/registro") return undefined;
  return url;
}

export function saveReturnUrl(url: string): void {
  const safe = safeReturnUrl(url);
  if (!safe) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ url: safe, at: Date.now() }));
  } catch {
    /* localStorage bloqueado: queda el estado del router */
  }
}

export function readReturnUrl(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const { url, at } = JSON.parse(raw) as { url?: string; at?: number };
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    return safeReturnUrl(url);
  } catch {
    return undefined;
  }
}

export function clearReturnUrl(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
}

/** Destino a usar tras autenticarse: el del router si vino, si no el guardado. */
export function resolveReturnUrl(fromState?: string): string | undefined {
  return safeReturnUrl(fromState) ?? readReturnUrl();
}
