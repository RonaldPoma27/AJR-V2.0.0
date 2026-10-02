import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export type ProjectStatus = "terminado" | "en_progreso";
export type MediaType = "image" | "video" | "file";

/** Un archivo de la galería. Hoy es un link; con Cloudinary será su `secure_url`. */
export interface ProjectMedia {
  id?: number;
  url: string;
  media_type: MediaType;
  caption: string | null;
  /** Id del archivo en Cloudinary (a futuro). */
  public_id?: string | null;
  position?: number;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  client_name: string | null;
  project_url: string | null;
  media: ProjectMedia[];
  /** Portada: primera imagen de la galería. */
  image_url: string | null;
  created_at?: string;
}

export interface ProjectInput {
  title: string;
  description: string;
  status: ProjectStatus;
  client_name: string | null;
  project_url: string | null;
  media: ProjectMedia[];
}

export const MAX_GALLERY_ITEMS = 30;

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

/** TECHNICIAN (editor) y ADMIN: crear o actualizar (PUT reemplaza todo, galería incluida). */
export function useSaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: ProjectInput }) => {
      const body = {
        ...input,
        media: input.media.map(({ url, media_type, caption, public_id }) => ({
          url,
          media_type,
          caption: caption || null,
          public_id: public_id || null,
        })),
      };
      const { data } = id
        ? await apiClient.put<Project>(`/portfolio/${id}`, body)
        : await apiClient.post<Project>("/portfolio", body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/** Solo ADMIN. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/portfolio/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
