import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Partner {
  id: number;
  name: string;
  logo_url: string | null;
  industry: string;
  created_at?: string;
  updated_at?: string;
}

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data } = await apiClient.get<Partner[]>("/partners");
      return data;
    },
  });
}
