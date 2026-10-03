/** Fecha y hora legibles en español rioplatense: "29 sept 2026, 14:05". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}
