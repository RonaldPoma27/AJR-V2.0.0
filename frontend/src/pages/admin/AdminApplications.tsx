import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useMe } from "@/api/auth";
import {
  useApplications,
  useTrashApplication,
  useUpdateApplicationStatus,
  type ApplicationStatus,
  type JobApplication,
} from "@/api/applications";
import { PAGE_SIZE } from "@/api/types";
import DetailRow, { ExternalLink } from "@/components/admin/DetailRow";
import ConfirmButton from "@/components/ui/ConfirmButton";
import Pager from "@/components/admin/Pager";
import StatusChips from "@/components/admin/StatusChips";
import StatusSelect from "@/components/admin/StatusSelect";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { APPLICATION_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

export default function AdminApplications() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useApplications({ page, status });
  const update = useUpdateApplicationStatus();
  const trash = useTrashApplication();
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN"; // solo ADMIN envía a la papelera
  const now = useNow();

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
        <h1 className="text-2xl font-bold text-fg">{t("adminApplications.title")}</h1>
        <p className="text-sm text-fg-subtle">{t("adminApplications.subtitle")}</p>
      </div>

      {data && (
        <StatusChips counts={data.counts} labels={APPLICATION_STATUS_LABELS} active={status} onSelect={selectStatus} />
      )}

      {isLoading && <p className="text-fg-subtle">{t("adminApplications.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("adminApplications.loadError")}{" "}
          <button onClick={() => refetch()} className="font-medium underline">{t("adminCommon.retry")}</button>
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(update.error) ?? t("adminCommon.statusChangeError")}
        </p>
      )}
      {trash.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(trash.error) ?? t("adminApplications.trashError")}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="rounded-md border bg-surface p-6 text-center text-fg-subtle">
          {status ? t("adminApplications.emptyFiltered") : t("adminApplications.empty")}
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
            now={now}
            onTrash={isAdmin ? () => trash.mutate(application.id) : undefined}
            trashing={trash.isPending && trash.variables === application.id}
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
  now,
  onTrash,
  trashing,
}: {
  application: JobApplication;
  open: boolean;
  onToggle: () => void;
  onStatus: (status: ApplicationStatus) => void;
  saving: boolean;
  now: number;
  /** Solo se pasa para ADMIN. */
  onTrash?: () => void;
  trashing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="overflow-hidden rounded-lg border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-fg">{a.full_name}</p>
          <p className="text-sm text-fg-subtle">
            {a.area}
            {a.experience_level ? ` · ${a.experience_level}` : ""} · {a.location} · {t("adminApplications.received", { time: timeAgo(a.created_at, now) })}
          </p>
          {!open && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{a.motivation}</p>}
          <span className="mt-1 inline-block text-xs font-medium text-accent">{open ? t("adminCommon.seeLess") : t("adminCommon.seeAll")}</span>
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
            label={t("adminApplications.changeStatusLabel", { name: a.full_name })}
          />
        </div>
      </div>

      {open && (
        <dl className="space-y-3 border-t bg-surface-2 p-4">
          <DetailRow label={t("adminApplications.name")}>{a.full_name}</DetailRow>
          <DetailRow label={t("adminCommon.email")}>
            <a href={`mailto:${a.email}`} className="text-accent hover:underline">{a.email}</a>
          </DetailRow>
          <DetailRow label={t("adminApplications.phone")}>
            {a.phone && (
              <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">{a.phone}</a>
            )}
          </DetailRow>
          <DetailRow label={t("adminApplications.location")}>{a.location}</DetailRow>
          <DetailRow label={t("adminApplications.area")}>{a.area}</DetailRow>
          <DetailRow label={t("adminApplications.experience")}>{a.experience_level}</DetailRow>
          <DetailRow label={t("adminApplications.availability")}>{a.availability}</DetailRow>
          <DetailRow label="LinkedIn">{a.linkedin_url && <ExternalLink href={a.linkedin_url} />}</DetailRow>
          <DetailRow label="GitHub / Portfolio">{a.github_url && <ExternalLink href={a.github_url} />}</DetailRow>
          <DetailRow label="CV">{a.cv_url && <ExternalLink href={a.cv_url} />}</DetailRow>
          <DetailRow label={t("adminApplications.motivation")}>
            <span className="whitespace-pre-wrap">{a.motivation}</span>
          </DetailRow>
          <DetailRow label={t("adminApplications.consent")}>
            {a.consent ? t("adminApplications.consentAccepted", { date: a.consent_at ? formatDateTime(a.consent_at) : "—" }) : t("adminApplications.consentNone")}
          </DetailRow>
          <DetailRow label={t("adminApplications.receivedLabel")}>{formatDateTime(a.created_at)}</DetailRow>
          <DetailRow label={t("adminCommon.lastUpdate")}>{formatDateTime(a.updated_at)}</DetailRow>
          {onTrash && (
            <div className="pt-2">
              <ConfirmButton
                label={t("adminCommon.sendToTrash")}
                question={t("adminCommon.trashQuestion")}
                confirmLabel={t("adminCommon.trashConfirm")}
                onConfirm={onTrash}
                disabled={trashing}
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
              />
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
