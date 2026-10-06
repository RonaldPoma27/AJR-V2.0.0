import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { PAGE_SIZE, type Paginated, type PageResult } from "./types";

export type OrderStatus = "nuevo" | "en_revision" | "contactado" | "finalizado" | "descartado";

/** Camino "feliz" de un pedido (lo dibuja el Stepper). `descartado` queda fuera: es un desvío. */
export const ORDER_FLOW: OrderStatus[] = ["nuevo", "en_revision", "contactado", "finalizado"];

export interface ClientOrderCreate {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  industry: string;
  problem_description: string;
  /** Token de Cloudflare Turnstile (anti-bots). */
  turnstile_token?: string;
  /** Honeypot: tiene que ir vacío. Los bots lo completan. */
  website?: string;
}

export interface ClientOrder {
  id: number;
  /** null = pedido anterior a la v2.1 (se enviaba sin cuenta). */
  user_id: number | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  industry: string;
  problem_description: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

/** Requiere sesión: el pedido queda asociado al cliente logueado. */
export function useCreateOrder() {
  return useMutation({
    mutationFn: async (payload: ClientOrderCreate) => {
      const { data } = await apiClient.post<{ ok: boolean }>("/orders", payload);
      return data;
    },
  });
}

/** Privado: pedidos entrantes, paginados y con contadores por estado. */
export function useOrders({ page, status }: { page: number; status?: OrderStatus | null }) {
  return useQuery({
    queryKey: ["orders", { page, status: status ?? null }],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PageResult<ClientOrder>> => {
      const { data } = await apiClient.get<Paginated<ClientOrder>>("/orders", {
        params: { skip: page * PAGE_SIZE, limit: PAGE_SIZE, status: status ?? undefined },
      });
      return { ...data, page };
    },
  });
}

/** Privado: actualizar el estado de un pedido. */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: OrderStatus }) => {
      const { data } = await apiClient.patch<ClientOrder>(`/orders/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/** "Mis pedidos": solo los del usuario logueado. */
export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "mine"],
    queryFn: async () => {
      const { data } = await apiClient.get<ClientOrder[]>("/orders/mine");
      return data;
    },
  });
}

/** Solo ADMIN: enviar a la papelera (borrado lógico). */
export function useTrashOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}
