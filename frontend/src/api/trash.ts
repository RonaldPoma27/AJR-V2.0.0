import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export type TrashKind = "order" | "application";

export interface TrashItem {
  kind: TrashKind;
  id: number;
  title: string;
  subtitle: string;
  deleted_at: string;
  purge_at: string;
  /** Segundos que faltan para la eliminación definitiva (calculado por el servidor). */
  seconds_left: number;
}

export interface TrashList {
  retention_days: number;
  items: TrashItem[];
}

/** Solo ADMIN. */
export function useTrash() {
  return useQuery({
    queryKey: ["trash"],
    queryFn: async () => (await apiClient.get<TrashList>("/trash")).data,
  });
}

export function useRestoreTrashItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: TrashKind; id: number }) => {
      await apiClient.post(`/trash/${kind}/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
