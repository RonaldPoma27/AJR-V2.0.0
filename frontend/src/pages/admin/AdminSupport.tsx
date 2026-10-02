import { useEffect, useState } from "react";
import {
  useStaffSupportTickets,
  useUpdateSupportStatus,
  type SupportStatus,
  type SupportTicket,
} from "@/api/support";
import { PAGE_SIZE } from "@/api/types";
import DetailRow from "@/components/admin/DetailRow";
import Pager from "@/components/admin/Pager";
import StatusChips from "@/components/admin/StatusChips";
import StatusSelect from "@/components/admin/StatusSelect";
import ChatThread from "@/components/support/ChatThread";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { STATUS_BADGE, SUPPORT_STATUS_LABELS } from "@/lib/status";
import { formatDuration, timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Comentarios / Soporte: misma grilla que Pedidos, con el chat de cada cliente. */
export default function AdminSupport() {
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useStaffSupportTickets({ page, status });
  const update = useUpdateSupportStatus();
  const now = useNow();

  useEffect(() => {
    if (data && data.page === page && data.items.length === 0 && page > 0) setPage(page - 1);
  }, [data, page]);

  function selectStatus(next: string | null) {
    setStatus(next as SupportStatus | null);
    setPage(0);
    setExpanded(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-fg">Comentarios / Soporte</h1>
        <p className="text-sm text-fg-subtle">Chats de los clientes. Respondé desde acá; el cliente ve tu respuesta al instante.</p>
      </div>

      {data && <StatusChips counts={data.counts} labels={SUPPORT_STATUS_LABELS} active={status} onSelect={selectStatus} />}

      {isLoading && <p className="text-fg-subtle">Cargando chats…</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          No pudimos cargar los chats. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(update.error) ?? "No pudimos cambiar el estado. Probá de nuevo."}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="rounded-md border bg-surface p-6 text-center text-fg-subtle">
          {status ? "No hay chats con este estado." : "Todavía no hay chats de clientes."}
        </p>
      )}

      <ul className={cn("space-y-3", isFetching && "opacity-70")}>
        {data?.items.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            now={now}
            open={expanded === ticket.id}
            onToggle={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
            onStatus={(next) => update.mutate({ id: ticket.id, status: next })}
            saving={update.isPending && update.variables?.id === ticket.id}
          />
        ))}
      </ul>

      {data && <Pager page={data.page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => { setPage(p); setExpanded(null); }} disabled={isFetching} />}
    </div>
  );
}

function TicketCard({
  ticket: t,
  now,
  open,
  onToggle,
  onStatus,
  saving,
}: {
  ticket: SupportTicket;
  now: number;
  open: boolean;
  onToggle: () => void;
  onStatus: (status: SupportStatus) => void;
  saving: boolean;
}) {
  const owner = t.owner.full_name || t.owner.email;
  const waiting = t.status === "abierto";
  return (
    <li className="overflow-hidden rounded-lg border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-fg">{t.title}</p>
          <p className="text-sm text-fg-subtle">
            {owner} · Iniciado {timeAgo(t.created_at, now)} · Última actividad {timeAgo(t.last_message_at, now)}
          </p>
          {waiting && (
            <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
              Esperando respuesta desde {timeAgo(t.last_message_at, now)}
            </p>
          )}
          <span className="mt-1 inline-block text-xs font-medium text-accent">{open ? "Cerrar chat ▲" : "Abrir chat ▼"}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status])}>
            {SUPPORT_STATUS_LABELS[t.status]}
          </span>
          <StatusSelect value={t.status} labels={SUPPORT_STATUS_LABELS} onChange={onStatus} disabled={saving} label={`Cambiar estado del chat «${t.title}»`} />
        </div>
      </div>

      {open && (
        <div className="border-t bg-surface-2">
          <dl className="space-y-2 p-4">
            <DetailRow label="Cliente">{owner}</DetailRow>
            <DetailRow label="Email">
              <a href={`mailto:${t.owner.email}`} className="text-accent hover:underline">{t.owner.email}</a>
            </DetailRow>
            <DetailRow label="Iniciado">{formatDateTime(t.created_at)}</DetailRow>
            <DetailRow label="Primera respuesta">
              {t.first_response_at
                ? `${formatDateTime(t.first_response_at)} (tardó ${formatDuration(t.created_at, t.first_response_at)})`
                : "Todavía sin respuesta del equipo"}
            </DetailRow>
          </dl>
          <div className="mx-4 mb-4 h-[26rem] overflow-hidden rounded-md border bg-surface">
            <ChatThread ticketId={t.id} perspective="staff" className="h-full" />
          </div>
        </div>
      )}
    </li>
  );
}
