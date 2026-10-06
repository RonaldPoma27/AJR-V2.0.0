import { dateLocale } from "@/i18n";

/** Fecha y hora legibles según el idioma activo: "29 sept 2026, 14:05" / "Sep 29, 2026, 2:05 PM". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(dateLocale(), { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}
