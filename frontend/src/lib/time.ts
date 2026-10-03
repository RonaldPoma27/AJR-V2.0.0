import { useEffect, useState } from "react";

const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "hace 5 minutos", "ayer", "hace 3 días". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now; // negativo = pasado
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.trunc(diff / ms), unit);
  }
  return "hace instantes";
}

/** Duración entre dos fechas: "3 d 4 h", "2 h 15 min", "8 min". */
export function formatDuration(fromIso: string, toIso: string): string {
  let minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  minutes -= days * 1440;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  if (days) return `${days} d${hours ? ` ${hours} h` : ""}`;
  if (hours) return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
  return `${Math.max(1, minutes)} min`;
}

/** Tiempo que falta (en segundos), legible: "12 días", "1 día 5 h", "7 h", "menos de 1 h". */
export function formatRemaining(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days >= 1) return `${days} día${days > 1 ? "s" : ""}${days < 3 && hours ? ` ${hours} h` : ""}`;
  if (hours >= 1) return `${hours} h`;
  return "menos de 1 h";
}

/** Reloj que se actualiza solo: hace que los "hace X min" no queden congelados. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
