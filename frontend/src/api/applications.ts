import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { PAGE_SIZE, type Paginated, type PageResult } from "./types";

export type ApplicationStatus =
  | "nueva"
  | "en_revision"
  | "entrevista"
  | "descartada"
  | "contratada";

export interface ApplicationCreate {
  full_name: string;
  email: string;
  phone?: string;
  location: string;
  area: string;
  experience_level?: string;
  linkedin_url?: string;
  github_url?: string;
  cv_url?: string;
  motivation: string;
  availability?: string;
  consent: boolean;
  turnstile_token?: string;
  /** Honeypot: tiene que ir vacío. */
  website?: string;
}

export interface JobApplication {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  location: string;
  area: string;
  experience_level: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  cv_url: string | null;
  motivation: string;
  availability: string | null;
  consent: boolean;
  consent_at: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

/** Público: formulario de "Trabajá con nosotros". */
export function useCreateApplication() {
  return useMutation({
    mutationFn: async (payload: ApplicationCreate) => {
      const { data } = await apiClient.post<{ ok: boolean }>("/applications", payload);
      return data;
    },
  });
}

/** Privado: postulaciones, paginadas y con contadores por estado. */
export function useApplications({
  page,
  status,
}: {
  page: number;
  status?: ApplicationStatus | null;
}) {
  return useQuery({
    queryKey: ["applications", { page, status: status ?? null }],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PageResult<JobApplication>> => {
      const { data } = await apiClient.get<Paginated<JobApplication>>("/applications", {
        params: { skip: page * PAGE_SIZE, limit: PAGE_SIZE, status: status ?? undefined },
      });
      return { ...data, page };
    },
  });
}

/** Privado: cambiar el estado de una postulación. */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ApplicationStatus }) => {
      const { data } = await apiClient.patch<JobApplication>(`/applications/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

/** Solo ADMIN: enviar a la papelera (borrado lógico). */
export function useTrashApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}
