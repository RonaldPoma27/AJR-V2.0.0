import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { PAGE_SIZE, type Paginated, type PageResult } from "./types";

export type OrderStatus = "nuevo" | "en_revision" | "contactado" | "descartado";

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

/** Público: usado por el formulario de contacto. */
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
