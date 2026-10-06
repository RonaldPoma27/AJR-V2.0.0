import { useEffect, useState } from "react";
import i18n, { dateLocale } from "@/i18n";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "hace 5 minutos", "ayer", "hace 3 días" (o "5 minutes ago", "yesterday"...). */
export function timeAgo(iso: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "auto" });
  const diff = new Date(iso).getTime() - now; // negativo = pasado
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.trunc(diff / ms), unit);
  }
  return i18n.t("time.justNow");
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
  if (days >= 1) {
    const label = i18n.t(days > 1 ? "time.daysOther" : "time.daysOne", { count: days });
    return `${label}${days < 3 && hours ? ` ${hours} h` : ""}`;
  }
  if (hours >= 1) return `${hours} h`;
  return i18n.t("time.lessThanHour");
}

/** Espera corta legible ("25 min", "2 h 30 min"), para los mensajes de bloqueo. */
export function formatWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours) return `${hours} h${rest ? ` ${rest} min` : ""}`;
  return `${minutes} min`;
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
