import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export type ProjectStatus = "terminado" | "en_progreso";
export type MediaType = "image" | "video" | "file";
export type PortfolioBlockType = "text" | MediaType;
export type PortfolioBlockSize = "small" | "medium" | "large" | "wide" | "tall" | "full";

export interface ProjectMedia {
  id?: number;
  url: string;
  media_type: MediaType;
  caption: string | null;
  public_id?: string | null;
  position?: number;
}

export interface PortfolioTextMark {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string | null;
  gradient_start?: string | null;
  gradient_end?: string | null;
}

export interface PortfolioStyle {
  background_color: string;
  border_color: string;
  accent_color: string;
  text_color: string;
}

export interface PortfolioBlock {
  id: string;
  type: PortfolioBlockType;
  size: PortfolioBlockSize;
  text: string;
  url?: string | null;
  caption?: string | null;
  background_color: string;
  border_color: string;
  text_color: string;
  gradient_start?: string | null;
  gradient_end?: string | null;
  fit: "contain" | "cover";
  marks: PortfolioTextMark[];
}

export interface Project {
  id: number;
  title: string;
  description: string;
  status: ProjectStatus;
  client_name: string | null;
  project_url: string | null;
  logo_url: string | null;
  position: number;
  style: PortfolioStyle;
  blocks: PortfolioBlock[];
  media: ProjectMedia[];
  image_url: string | null;
  created_at?: string;
}

export interface ProjectInput {
  title: string;
  description: string;
  status: ProjectStatus;
  client_name: string | null;
  project_url: string | null;
  logo_url: string | null;
  style: PortfolioStyle;
  blocks: PortfolioBlock[];
  media: ProjectMedia[];
}

export const MAX_GALLERY_ITEMS = 30;
export const MAX_PORTFOLIO_BLOCKS = 40;
export const BLOCK_TEXT_LIMITS: Record<PortfolioBlockSize, number> = {
  small: 140,
  medium: 280,
  large: 520,
  wide: 640,
  tall: 420,
  full: 900,
};

const DEFAULT_STYLE: PortfolioStyle = {
  background_color: "#151515",
  border_color: "#383838",
  accent_color: "#22D3EE",
  text_color: "#F3F4F6",
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await apiClient.get<Project[]>("/portfolio", { params: { limit: 100 } });
      return data.map((project) => ({
        ...project,
        style: { ...DEFAULT_STYLE, ...project.style },
        blocks: project.blocks ?? [],
        media: project.media ?? [],
      }));
    },
  });
}

/** TECHNICIAN (editor) y ADMIN: crear o actualizar el proyecto completo. */
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

export function useReorderProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { data } = await apiClient.post<Project[]>("/portfolio/reorder", { ids });
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
