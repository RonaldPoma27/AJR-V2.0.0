import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/api/client";
import {
  updateAgileProject,
  type AgileProject,
  type AgileItem,
  type AgileSprint,
} from "@/api/agile";
const field = "w-full rounded-xl border border-line bg-app p-3 text-fg";
const button = "rounded-xl bg-brand px-4 py-2 text-white disabled:opacity-50";
export function ProjectSettings({
  project,
  onSaved,
}: {
  project: AgileProject;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [weeks, setWeeks] = useState(project.sprint_length_weeks);
  const [status, setStatus] = useState(project.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-4 rounded-2xl border border-line bg-surface p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await updateAgileProject(project.id, {
            name,
            description,
            sprint_length_weeks: weeks,
            status,
          });
          await onSaved();
        } catch {
          setError(t("agile.errors.generic"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">{t("agile.settings")}</h2>
      <label>
        {t("agile.projectName")}
        <input
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={140}
        />
      </label>
      <label>
        {t("agile.description")}
        <textarea
          className={field}
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        {t("agile.sprintLength")}
        <select
          className={field}
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
        >
          {[1, 2, 3, 4].map((w) => (
            <option key={w} value={w}>
              {w} {t("agile.weeksLabel")}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("agile.projectState")}
        <select
          className={field}
          value={status}
          onChange={(e) => setStatus(e.target.value as AgileProject["status"])}
        >
          <option value="ACTIVE">{t("agile.activeLabel")}</option>
          <option value="ARCHIVED">{t("agile.archivedLabel")}</option>
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <button className={button} disabled={busy}>
        {t("agile.saveProject")}
      </button>
    </form>
  );
}
export function ProjectActivity({ projectId }: { projectId: number }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["agile", projectId, "activity", page],
    queryFn: async () =>
      (
        await apiClient.get<
          Array<{
            id: number;
            action: string;
            entity: string;
            label: string;
            actor: string;
            created_at: string;
            changes: Record<string, unknown>;
          }>
        >(`/agile/projects/${projectId}/activity`, {
          params: { offset: page * 100, limit: 100 },
        })
      ).data,
  });
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-bold">{t("agile.activityHistory")}</h2>
      {query.isLoading && <p>{t("agile.loadingHistory")}</p>}
      {query.isError && (
        <button onClick={() => void query.refetch()}>{t("agile.retry")}</button>
      )}
      {query.data?.length === 0 && <p>{t("agile.noHistory")}</p>}
      {query.data?.map((row) => (
        <details key={row.id} className="rounded-xl border border-line p-3">
          <summary>
            {row.label || row.entity} · {t(`agile.actions.${row.action}`)} ·{" "}
            {row.actor} · {new Date(row.created_at).toLocaleString()}
          </summary>
          <pre className="whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(row.changes, null, 2)}
          </pre>
        </details>
      ))}
      <div className="flex gap-3">
        <button disabled={!page} onClick={() => setPage(page - 1)}>
          ←
        </button>
        <span>{page + 1}</span>
        <button
          disabled={(query.data?.length ?? 0) < 100}
          onClick={() => setPage(page + 1)}
        >
          →
        </button>
      </div>
    </section>
  );
}
export function CloseSprintReview({
  sprint,
  sprints,
  items,
  onConfirm,
  busy,
}: {
  sprint: AgileSprint;
  sprints: AgileSprint[];
  items: AgileItem[];
  onConfirm: (target: number | null, ids: number[]) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const current = items.filter((i) => i.sprint_id === sprint.id);
  const pending = current.filter((i) => i.status !== "DONE");
  const [selected, setSelected] = useState(pending.map((i) => i.id));
  const [target, setTarget] = useState("");
  return (
    <div className="space-y-4">
      <p>{t("agile.closeReviewHint")}</p>
      <label>
        {t("agile.destination")}
        <select
          className={field}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">{t("agile.backlog")}</option>
          {sprints
            .filter(
              (s) => s.status === "PLANNED" && s.start_date > sprint.end_date,
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      {current.map((item) => (
        <label
          key={item.id}
          className="flex gap-2 rounded-lg border border-line p-2"
        >
          <input
            type="checkbox"
            disabled={item.status === "DONE" || !target}
            checked={selected.includes(item.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, item.id]
                  : selected.filter((id) => id !== item.id),
              )
            }
          />
          <span>
            {item.key} · {item.title} · {t(`agile.statuses.${item.status}`)}
          </span>
        </label>
      ))}
      <button
        className={button}
        disabled={busy}
        onClick={() => void onConfirm(target ? Number(target) : null, selected)}
      >
        {t("agile.confirmClose")}
      </button>
    </div>
  );
}
export function ImportMapping({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: Record<string, number>;
  onChange: (mapping: Record<string, number>) => void;
}) {
  const { t } = useTranslation();
  const fields = [
    "title",
    "type",
    "description",
    "epic",
    "priority",
    "status",
    "points",
    "assigned_role",
    "assignee_email",
    "sprint",
    "acceptance_criteria",
    "due_date",
  ];
  return (
    <fieldset className="mt-4 grid gap-3 sm:grid-cols-3">
      <legend className="font-semibold">{t("agile.mapColumns")}</legend>
      {fields.map((key) => (
        <label key={key} className="text-xs">
          {t(`agile.importFields.${key}`)}
          <select
            className={field}
            value={mapping[key] ?? ""}
            onChange={(e) => {
              const next = { ...mapping };
              if (e.target.value === "") delete next[key];
              else next[key] = Number(e.target.value);
              onChange(next);
            }}
          >
            <option value="">{t("agile.automatic")}</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>
                {i + 1}. {h}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

export function SprintTimeline({ sprints }: { sprints: AgileSprint[] }) {
  const { t } = useTranslation();
  if (!sprints.length) return null;
  const day = (value: string) => Date.parse(value + "T00:00:00Z") / 86400000;
  const min = Math.min(...sprints.map((s) => day(s.start_date))),
    max = Math.max(...sprints.map((s) => day(s.end_date))) + 1,
    span = Math.max(1, max - min);
  return (
    <section
      className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface p-4"
      aria-label={t("agile.timelineTitle")}
    >
      <div className="min-w-[560px] space-y-3">
        {sprints.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[140px_1fr] items-center gap-3"
          >
            <span className="text-sm">{s.name}</span>
            <div className="relative h-12 rounded-lg bg-surface-2">
              <div
                className="absolute h-12 min-w-1 rounded-lg border border-accent bg-accent/20"
                style={{
                  left: `${((day(s.start_date) - min) / span) * 100}%`,
                  width: `${((day(s.end_date) - day(s.start_date) + 1) / span) * 100}%`,
                }}
                title={`${s.name}: ${s.start_date} – ${s.end_date}`}
              >
                <span className="block truncate px-2 text-xs">
                  {s.start_date}
                  <br />
                  {s.end_date}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
