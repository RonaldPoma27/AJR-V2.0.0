import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import { getToken } from "./auth";

export interface BackupEmailState {
  status: "not_configured" | "pending" | "verified";
  email: string | null;
  verified_at: string | null;
  pending_email: string | null;
  pending_expires_at: string | null;
}

export async function fetchBackupEmailState(): Promise<BackupEmailState> {
  const { data } = await apiClient.get<BackupEmailState>("/security/backup-email");
  return data;
}

function useRefreshBackupEmail() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["backupEmail", "state"] });
}

export function useBackupEmailState() {
  return useQuery({
    queryKey: ["backupEmail", "state"],
    queryFn: fetchBackupEmailState,
    enabled: Boolean(getToken()),
    retry: false,
  });
}

export function useRequestBackupEmail() {
  const refresh = useRefreshBackupEmail();
  return useMutation({
    mutationFn: async (payload: { email: string; current_password: string }) => {
      const { data } = await apiClient.post<BackupEmailState>("/security/backup-email/request", payload);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useVerifyBackupEmail() {
  const refresh = useRefreshBackupEmail();
  return useMutation({
    mutationFn: async (payload: { code: string }) => {
      const { data } = await apiClient.post<BackupEmailState>("/security/backup-email/verify", payload);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useResendBackupEmail() {
  const refresh = useRefreshBackupEmail();
  return useMutation({
    mutationFn: async (payload: { current_password: string }) => {
      const { data } = await apiClient.post<BackupEmailState>("/security/backup-email/resend", payload);
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDeleteBackupEmail() {
  const refresh = useRefreshBackupEmail();
  return useMutation({
    mutationFn: async (payload: { current_password: string }) => {
      const { data } = await apiClient.delete<BackupEmailState>("/security/backup-email", { data: payload });
      return data;
    },
    onSuccess: refresh,
  });
}
