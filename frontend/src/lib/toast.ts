import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "info";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function add(kind: ToastKind, message: string, duration = 4500): number {
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, message, duration }]; // máximo 4 a la vez
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Notificaciones: toast.success("Guardado"), toast.error("Falló"), toast.info("Aviso"). */
export const toast = {
  success: (message: string, duration?: number) => add("success", message, duration),
  error: (message: string, duration?: number) => add("error", message, duration ?? 6000),
  info: (message: string, duration?: number) => add("info", message, duration),
  dismiss: dismissToast,
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useToasts = () => useSyncExternalStore(subscribe, () => items);
