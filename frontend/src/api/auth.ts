import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient, TOKEN_KEY } from "./client";

export type UserRole = "USER" | "TECHNICIAN" | "ADMIN";

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  /** first_name + last_name (lo arma el backend). */
  full_name: string | null;
  role: UserRole;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const isStaff = (role?: UserRole) => role === "ADMIN" || role === "TECHNICIAN";

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>("/auth/me");
  return data;
}

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

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

/** Registro público: el backend siempre crea un usuario con rol USER. */
export async function registerRequest(payload: RegisterPayload): Promise<CurrentUser> {
  const { data } = await apiClient.post<CurrentUser>("/auth/register", payload);
  return data;
}

/** Usuario logueado (solo consulta si hay token). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
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
    navigate("/", { replace: true });
  };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      await apiClient.patch("/users/me/password", payload);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { first_name: string; last_name: string }) => {
      const { data } = await apiClient.patch<CurrentUser>("/users/me", payload);
      return data;
    },
    onSuccess: (me) => queryClient.setQueryData(["me"], me),
  });
}
