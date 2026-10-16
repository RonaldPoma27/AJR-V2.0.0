import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusiona clases de Tailwind evitando conflictos (usado por components/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
