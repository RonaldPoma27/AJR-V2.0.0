import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface AuditEntry {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  entity_label: string | null;
  /** { campo: { old, new } } — en las contraseñas solo { changed: true }. */
  changes: Record<string, { old?: unknown; new?: unknown; changed?: boolean }> | null;
  ip: string | null;
  method: string | null;
  path: string | null;
  detail: string | null;
  created_at: string;
  /** Fecha y hora en la zona horaria de Argentina, armadas por el servidor. */
  date_ar: string;
  time_ar: string;
  timezone: string;
}

export interface AuditPage {
  total: number;
  items: AuditEntry[];
}

export interface AuditFilters {
  users: { id: number | null; email: string }[];
  actions: string[];
  entities: string[];
}

export interface AuditQuery {
  page: number;
  userId?: number | null;
  action?: string;
  entity?: string;
  dateFrom?: string; // AAAA-MM-DD (día argentino)
  dateTo?: string;
  q?: string;
}

export const AUDIT_PAGE_SIZE = 25;

/** Solo ADMIN. */
export function useAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: ["audit", "logs", query],
    queryFn: async () =>
      (
        await apiClient.get<AuditPage>("/audit/logs", {
          params: {
            skip: query.page * AUDIT_PAGE_SIZE,
            limit: AUDIT_PAGE_SIZE,
            user_id: query.userId ?? undefined,
            action: query.action || undefined,
            entity: query.entity || undefined,
            date_from: query.dateFrom || undefined,
            date_to: query.dateTo || undefined,
            q: query.q?.trim() || undefined,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useAuditFilters() {
  return useQuery({
    queryKey: ["audit", "filters"],
    queryFn: async () => (await apiClient.get<AuditFilters>("/audit/filters")).data,
  });
}

export interface IpBlock {
  ip: string;
  kind: "login_lock" | "flood_ban";
  reason: string;
  retry_after: number;
  blocked_until: string;
}

export function useIpBlocks() {
  return useQuery({
    queryKey: ["audit", "blocks"],
    queryFn: async () => (await apiClient.get<IpBlock[]>("/audit/blocks")).data,
  });
}

export function useReleaseIp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ip: string) => {
      await apiClient.delete(`/audit/blocks/${encodeURIComponent(ip)}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit"] }),
  });
}
