import { useEffect, useState } from "react";
import {
  useApplications,
  useUpdateApplicationStatus,
  type ApplicationStatus,
  type JobApplication,
} from "@/api/applications";
import { PAGE_SIZE } from "@/api/types";
import DetailRow, { ExternalLink } from "@/components/admin/DetailRow";
import Pager from "@/components/admin/Pager";
import StatusChips from "@/components/admin/StatusChips";
import StatusSelect from "@/components/admin/StatusSelect";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { APPLICATION_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { cn } from "@/lib/utils";

export default function AdminApplications() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useApplications({ page, status });
  const update = useUpdateApplicationStatus();

  useEffect(() => {
    if (data && data.page === page && data.items.length === 0 && page > 0) setPage(page - 1);
  }, [data, page]);

  function selectStatus(next: string | null) {
    setStatus(next as ApplicationStatus | null);
    setPage(0);
    setExpanded(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Postulaciones</h1>
        <p className="text-sm text-gray-500">Personas que quieren sumarse al equipo.</p>
      </div>

      {data && (
        <StatusChips counts={data.counts} labels={APPLICATION_STATUS_LABELS} active={status} onSelect={selectStatus} />
      )}

      {isLoading && <p className="text-gray-500">Cargando postulaciones…</p>}
      {isError && (
        <p role="alert" className="text-red-600">
          No pudimos cargar las postulaciones.{" "}
          <button onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-600">
          {getServerDetail(update.error) ?? "No pudimos cambiar el estado. Probá de nuevo."}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="rounded-md border bg-white p-6 text-center text-gray-500">
          {status ? "No hay postulaciones con este estado." : "Todavía no llegó ninguna postulación."}
        </p>
      )}

      <ul className={cn("space-y-3", isFetching && "opacity-70")}>
        {data?.items.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            open={expanded === application.id}
            onToggle={() => setExpanded(expanded === application.id ? null : application.id)}
            onStatus={(next) => update.mutate({ id: application.id, status: next })}
            saving={update.isPending && update.variables?.id === application.id}
          />
        ))}
      </ul>

      {data && (
        <Pager page={data.page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => { setPage(p); setExpanded(null); }} disabled={isFetching} />
      )}
    </div>
  );
}

function ApplicationCard({
  application: a,
  open,
  onToggle,
  onStatus,
  saving,
}: {
  application: JobApplication;
  open: boolean;
  onToggle: () => void;
  onStatus: (status: ApplicationStatus) => void;
  saving: boolean;
}) {
  return (
    <li className="overflow-hidden rounded-lg border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-gray-900">{a.full_name}</p>
          <p className="text-sm text-gray-500">
            {a.area}
            {a.experience_level ? ` · ${a.experience_level}` : ""} · {a.location} · Recibida {formatDateTime(a.created_at)}
          </p>
          {!open && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{a.motivation}</p>}
          <span className="mt-1 inline-block text-xs font-medium text-brand">{open ? "Ver menos ▲" : "Ver todo ▼"}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[a.status])}>
            {APPLICATION_STATUS_LABELS[a.status]}
          </span>
          <StatusSelect
            value={a.status}
            labels={APPLICATION_STATUS_LABELS}
            onChange={onStatus}
            disabled={saving}
            label={`Cambiar estado de la postulación de ${a.full_name}`}
          />
        </div>
      </div>

      {open && (
        <dl className="space-y-3 border-t bg-gray-50 p-4">
          <DetailRow label="Nombre">{a.full_name}</DetailRow>
          <DetailRow label="Email">
            <a href={`mailto:${a.email}`} className="text-brand hover:underline">{a.email}</a>
          </DetailRow>
          <DetailRow label="Teléfono / WhatsApp">
            {a.phone && (
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="text-brand hover:underline">{a.phone}</a>
            )}
          </DetailRow>
          <DetailRow label="Ciudad y país">{a.location}</DetailRow>
          <DetailRow label="Área de interés">{a.area}</DetailRow>
          <DetailRow label="Experiencia">{a.experience_level}</DetailRow>
          <DetailRow label="Disponibilidad">{a.availability}</DetailRow>
          <DetailRow label="LinkedIn">{a.linkedin_url && <ExternalLink href={a.linkedin_url} />}</DetailRow>
          <DetailRow label="GitHub / Portfolio">{a.github_url && <ExternalLink href={a.github_url} />}</DetailRow>
          <DetailRow label="CV">{a.cv_url && <ExternalLink href={a.cv_url} />}</DetailRow>
          <DetailRow label="Por qué quiere sumarse">
            <span className="whitespace-pre-wrap">{a.motivation}</span>
          </DetailRow>
          <DetailRow label="Consentimiento de datos">
            {a.consent ? `Aceptado el ${a.consent_at ? formatDateTime(a.consent_at) : "—"}` : "No registrado"}
          </DetailRow>
          <DetailRow label="Recibida">{formatDateTime(a.created_at)}</DetailRow>
          <DetailRow label="Última actualización">{formatDateTime(a.updated_at)}</DetailRow>
        </dl>
      )}
    </li>
  );
}
