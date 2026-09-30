import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export type ProjectStatus = "terminado" | "en_progreso";

export interface Project {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  status: ProjectStatus;
  client_name: string | null;
  project_url: string | null;
  created_at?: string;
}

/** En el backend nuevo los proyectos viven en /portfolio (antes /projects). */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await apiClient.get<Project[]>("/portfolio");
      return data;
    },
  });
}
