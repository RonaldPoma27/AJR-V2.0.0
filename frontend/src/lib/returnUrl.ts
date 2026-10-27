/**
 * "A dónde volver después de iniciar sesión". Además del estado del router (`location.state.from`),
 * se guarda en localStorage para sobrevivir a una recarga o a ir de /login a /registro y viceversa.
 */
const KEY = "ajrdata_return_url";

const isSafe = (url: string) => url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/login") && !url.startsWith("/registro");

export function saveReturnUrl(url: string) {
  if (!isSafe(url)) return;
  try {
    localStorage.setItem(KEY, url);
  } catch {
    /* localStorage bloqueado: queda solo el estado del router */
  }
}

export function readReturnUrl(): string | undefined {
  try {
    const url = localStorage.getItem(KEY);
    return url && isSafe(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

export function clearReturnUrl() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
}
