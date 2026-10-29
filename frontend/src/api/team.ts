import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "./auth";
import { apiClient } from "./client";

const KEY = ["technicians"];

/** TECHNICIAN y ADMIN pueden ver la lista. */
export function useTechnicians() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<CurrentUser[]>("/team/technicians")).data,
  });
}

/** Solo ADMIN: promover a un usuario registrado, por su email. */
export function usePromoteTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await apiClient.post<CurrentUser>("/team/technicians", { email })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** Solo ADMIN: quitar el rol. */
export function useRemoveTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) =>
      (await apiClient.delete<CurrentUser>(`/team/technicians/${userId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
