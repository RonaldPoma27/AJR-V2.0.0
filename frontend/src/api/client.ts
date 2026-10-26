import axios, { isAxiosError } from "axios";

export const TOKEN_KEY = "ajrdata_token";

/**
 * Cliente Axios hacia FastAPI.
 * - Dev: proxy de Vite (`/api` → localhost:8000).
 * - Producción (monolito en Render): mismo dominio, también `/api`.
 * - Solo si el frontend se sirve aparte, definí VITE_API_URL (debe terminar en `/api`).
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sesión vencida o token inválido: se borra el token y se manda al login.
// Excepción: el propio login (un 401 ahí solo significa "credenciales incorrectas").
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.endsWith("/auth/login")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
