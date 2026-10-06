import { useState } from "react";
import { ShieldAlert, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AUDIT_PAGE_SIZE,
  useAuditFilters,
  useAuditLogs,
  useIpBlocks,
  useReleaseIp,
  type AuditEntry,
} from "@/api/audit";
import Pager from "@/components/admin/Pager";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { getServerDetail } from "@/lib/errors";
import { formatWait } from "@/lib/time";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const ACTION_BADGE: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  trash: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  restore: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
  login_failed: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  ip_locked: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  ip_banned: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
};
const DEFAULT_BADGE = "bg-gray-200 text-gray-700 dark:bg-gray-500/25 dark:text-gray-300";

function formatValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === "") return emptyLabel;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Changes({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  const empty = t("audit.emptyValue");
  const rows = Object.entries(entry.changes ?? {});
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map(([field, change]) => (
        <li key={field} className="break-words">
          <span className="font-medium text-fg-muted">{t(`audit.fields.${field}`, { defaultValue: field })}</span>
          {": "}
          {change.changed ? (
            <span className="text-fg">{t("audit.changed")}</span>
          ) : "old" in change && "new" in change ? (
            <>
              <span className="text-fg-subtle line-through">{formatValue(change.old, empty)}</span>
              {" → "}
              <span className="text-fg">{formatValue(change.new, empty)}</span>
            </>
          ) : (
            <span className="text-fg">{formatValue(change.new ?? change.old, empty)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasChanges = Boolean(entry.changes && Object.keys(entry.changes).length > 0);
  const entityName = entry.entity ? t(`audit.entities.${entry.entity}`, { defaultValue: entry.entity }) : null;
  const target = [entityName, entry.entity_label ?? (entry.entity_id ? `#${entry.entity_id}` : null)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            ACTION_BADGE[entry.action] ?? DEFAULT_BADGE
          )}
        >
          {t(`audit.actions.${entry.action}`, { defaultValue: entry.action })}
        </span>
        <span className="font-medium text-fg">{entry.user_email ?? t("audit.system")}</span>
        {entry.user_role && (
          <span className="text-xs text-fg-subtle">{t(`sidebar.roles.${entry.user_role}`, { defaultValue: entry.user_role })}</span>
        )}
        <span className="ml-auto text-sm tabular-nums text-fg-muted">
          {entry.date_ar} {entry.time_ar}{" "}
          <abbr title={entry.timezone} className="no-underline">
            {t("audit.tzShort")}
          </abbr>
        </span>
      </div>
      {target && <p className="text-sm text-fg">{target}</p>}
      {entry.detail && <p className="text-sm text-fg-muted">{entry.detail}</p>}
      <p className="text-xs text-fg-subtle">
        {entry.ip && <span>IP {entry.ip}</span>}
        {entry.method && entry.path && (
          <span>
            {entry.ip ? " · " : ""}
            {entry.method} {entry.path}
          </span>
        )}
      </p>
      {hasChanges && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-sm font-medium text-accent hover:underline"
          >
            {open ? t("audit.hideChanges") : t("audit.showChanges", { count: Object.keys(entry.changes ?? {}).length })}
          </button>
          {open && (
            <div className="mt-2 rounded-md bg-surface-2 p-3">
              <Changes entry={entry} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function BlockedIps() {
  const { t } = useTranslation();
  const { data } = useIpBlocks();
  const release = useReleaseIp();
  if (!data || data.length === 0) return null;
  return (
    <section aria-labelledby="blocked-ips" className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
      <h2 id="blocked-ips" className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        {t("audit.blocked.title")}
      </h2>
      {release.isError && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {getServerDetail(release.error) ?? t("audit.blocked.releaseError")}
        </p>
      )}
      <ul className="mt-3 divide-y divide-red-200 dark:divide-red-500/20">
        {data.map((block) => (
          <li key={block.ip} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <div className="text-sm">
              <p className="font-medium text-fg">
                {block.ip}{" "}
                <span className="font-normal text-fg-muted">
                  — {block.kind === "flood_ban" ? t("audit.blocked.banned") : t("audit.blocked.locked")}
                </span>
              </p>
              <p className="text-fg-subtle">
                {t("audit.blocked.remaining", { time: formatWait(block.retry_after) })}
              </p>
            </div>
            <ConfirmButton
              label={t("audit.blocked.release")}
              question={t("audit.blocked.confirmQuestion")}
              confirmLabel={t("audit.blocked.confirm")}
              icon={<Unlock className="h-4 w-4" aria-hidden />}
              disabled={release.isPending}
              onConfirm={() => release.mutate(block.ip)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Solo ADMIN: qué hizo cada ADMIN / TECHNICIAN, cuándo (hora argentina) y desde qué IP. */
export default function AdminAudit() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const { data: filters } = useAuditFilters();
  const { data, isLoading, isError, isFetching, refetch } = useAuditLogs({
    page,
    userId,
    action,
    entity,
    dateFrom,
    dateTo,
    q: search,
  });

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("audit.title")}</h1>
        <p className="text-sm text-fg-subtle">{t("audit.description")}</p>
      </div>

      <BlockedIps />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm text-fg-muted lg:col-span-3">
          {t("audit.filters.search")}
          <input
            type="search"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
            placeholder={t("audit.filters.searchPlaceholder")}
            maxLength={100}
            className={cn(inputClass, "mt-1")}
          />
        </label>
        <label className="block text-sm text-fg-muted">
          {t("audit.filters.user")}
          <select
            value={userId ?? ""}
            onChange={(e) => change(setUserId)(e.target.value ? Number(e.target.value) : null)}
            className={cn(inputClass, "mt-1")}
          >
            <option value="">{t("audit.filters.all")}</option>
            {filters?.users
              .filter((u) => u.id !== null)
              .map((u) => (
                <option key={u.id} value={u.id as number}>
                  {u.email}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm text-fg-muted">
          {t("audit.filters.action")}
          <select value={action} onChange={(e) => change(setAction)(e.target.value)} className={cn(inputClass, "mt-1")}>
            <option value="">{t("audit.filters.all")}</option>
            {filters?.actions.map((a) => (
              <option key={a} value={a}>
                {t(`audit.actions.${a}`, { defaultValue: a })}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-fg-muted">
          {t("audit.filters.entity")}
          <select value={entity} onChange={(e) => change(setEntity)(e.target.value)} className={cn(inputClass, "mt-1")}>
            <option value="">{t("audit.filters.all")}</option>
            {filters?.entities.map((en) => (
              <option key={en} value={en}>
                {t(`audit.entities.${en}`, { defaultValue: en })}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-fg-muted">
          {t("audit.filters.from")}
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => change(setDateFrom)(e.target.value)} className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block text-sm text-fg-muted">
          {t("audit.filters.to")}
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => change(setDateTo)(e.target.value)} className={cn(inputClass, "mt-1")} />
        </label>
      </div>
      <p className="text-xs text-fg-subtle">{t("audit.timezoneNote")}</p>

      {isLoading && <p className="text-fg-subtle">{t("audit.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("audit.loadError")}{" "}
          <button onClick={() => refetch()} className="font-medium underline">
            {t("audit.retry")}
          </button>
        </p>
      )}
      {data && data.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-10 text-center text-fg-subtle">{t("audit.empty")}</p>
      )}
      {data && data.items.length > 0 && (
        <ul className={cn("divide-y rounded-lg border bg-surface", isFetching && "opacity-70")}>
          {data.items.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
      {data && <Pager page={page} pageSize={AUDIT_PAGE_SIZE} total={data.total} onPage={setPage} disabled={isFetching} />}
    </div>
  );
}
