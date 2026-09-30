import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient, TOKEN_KEY } from "./client";

export type UserRole = "USER" | "TECHNICIAN" | "ADMIN";

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);

/** El backend usa el login estándar OAuth2: form-urlencoded con `username` = email. */
export async function loginRequest(email: string, password: string): Promise<string> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const { data } = await apiClient.post<{ access_token: string }>("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem(TOKEN_KEY, data.access_token);
  return data.access_token;
}

/** Usuario logueado (solo consulta si hay token). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await apiClient.get<CurrentUser>("/auth/me");
      return data;
    },
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    navigate("/login", { replace: true });
  };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      await apiClient.patch("/users/me/password", payload);
    },
  });
}
