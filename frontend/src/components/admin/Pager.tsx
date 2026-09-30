/** Paginación con "Anterior / Siguiente" y "Mostrando X–Y de N". `page` empieza en 0. */
export default function Pager({
  page,
  pageSize,
  total,
  onPage,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  if (total === 0) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const hasPrev = page > 0;
  const hasNext = to < total;
  const button =
    "rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-700";

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-500" aria-live="polite">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={!hasPrev || disabled} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <button type="button" className={button} disabled={!hasNext || disabled} onClick={() => onPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
