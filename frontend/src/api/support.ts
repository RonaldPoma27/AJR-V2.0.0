import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "./auth";
import { apiClient } from "./client";
import { PAGE_SIZE, type Paginated, type PageResult } from "./types";

export type SupportStatus = "abierto" | "respondido" | "cerrado";

/** Largo máximo de un mensaje (el backend lo vuelve a validar). */
export const MAX_MESSAGE_LENGTH = 2000;
/** Máximo de mensajes seguidos del cliente sin respuesta del equipo (lo hace cumplir el backend). */
export const MAX_CONSECUTIVE_MESSAGES = 2;

export interface SupportTicket {
  id: number;
  user_id: number;
  owner: CurrentUser;
  title: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  first_response_at: string | null;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_name: string;
  /** true = lo escribió el dueño del chat; false = el equipo. */
  from_customer: boolean;
  content: string;
  created_at: string;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
  /** Si quien consulta puede escribir ahora. */
  can_send: boolean;
  block_reason: "closed" | "awaiting_support" | null;
}

const key = {
  mine: ["support", "mine"] as const,
  ticket: (id: number) => ["support", "ticket", id] as const,
};

/** Historial de chats del usuario logueado, agrupados por título. */
export function useMySupportTickets() {
  return useQuery({
    queryKey: key.mine,
    queryFn: async () => (await apiClient.get<SupportTicket[]>("/support/tickets/mine")).data,
  });
}

/** Un chat con sus mensajes. Se consulta cada pocos segundos mientras está abierto en pantalla. */
export function useSupportTicket(id: number) {
  return useQuery({
    queryKey: key.ticket(id),
    queryFn: async () => (await apiClient.get<SupportTicketDetail>(`/support/tickets/${id}`)).data,
    refetchInterval: 8000, // por defecto react-query lo pausa si la pestaña está en segundo plano
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; message: string }) =>
      (await apiClient.post<SupportTicketDetail>("/support/tickets", payload)).data,
    onSuccess: (detail) => {
      queryClient.setQueryData(key.ticket(detail.id), detail);
      queryClient.invalidateQueries({ queryKey: ["support"] });
    },
  });
}

export function useSendSupportMessage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) =>
      (await apiClient.post<SupportTicketDetail>(`/support/tickets/${id}/messages`, { content })).data,
    onSuccess: (detail) => {
      queryClient.setQueryData(key.ticket(id), detail);
      queryClient.invalidateQueries({ queryKey: ["support"], predicate: (q) => q.queryKey[1] !== "ticket" });
    },
  });
}

/** TECHNICIAN y ADMIN: todos los chats, paginados y con contadores por estado. */
export function useStaffSupportTickets({ page, status }: { page: number; status?: SupportStatus | null }) {
  return useQuery({
    queryKey: ["support", "staff", { page, status: status ?? null }],
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    queryFn: async (): Promise<PageResult<SupportTicket>> => {
      const { data } = await apiClient.get<Paginated<SupportTicket>>("/support/tickets", {
        params: { skip: page * PAGE_SIZE, limit: PAGE_SIZE, status: status ?? undefined },
      });
      return { ...data, page };
    },
  });
}

export function useUpdateSupportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: SupportStatus }) =>
      (await apiClient.patch<SupportTicketDetail>(`/support/tickets/${id}`, { status })).data,
    onSuccess: (detail) => {
      queryClient.setQueryData(key.ticket(detail.id), detail);
      queryClient.invalidateQueries({ queryKey: ["support"], predicate: (q) => q.queryKey[1] !== "ticket" });
    },
  });
}
