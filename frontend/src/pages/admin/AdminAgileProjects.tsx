import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown,
  CircleAlert, Clock3, Columns3, FileSpreadsheet, Filter, FolderKanban, History,
  Layers, ListTodo, LoaderCircle, MessageSquare, Plus, RefreshCw, Search, Send,
  Settings2, ShieldCheck, Sparkles, Users, X, Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addAgileComment, archiveAgileItem, commitAgileGoogleImport, commitAgileImport, completeAgileSprint,
  createAgileItem, createAgileProject, createAgileSprint, fetchAgileComments,
  fetchAgileHistory, fetchAgileItems, fetchAgileMembers, fetchAgileProjects,
  fetchAgileSprints, fetchAgileStaff, previewAgileGoogleImport, previewAgileImport, reorderAgileBacklog, removeAgileMember,
  startAgileSprint, updateAgileItem, upsertAgileMember,
  type AgileComment, type AgileHistory, type AgileItem, type AgileItemInput,
  type AgileMember, type AgileProject, type AgileSprint, type ImportPreview,
  type ItemPriority, type ItemStatus, type ItemType, type ProjectRole,
} from "@/api/agile";
import { getServerDetail } from "@/lib/errors";
import { cn } from "@/lib/utils";

const VIEWS = ["overview", "backlog", "board", "epics", "sprints", "timeline", "team", "import"] as const;
type View = (typeof VIEWS)[number];
const STATUSES: ItemStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
const TYPES: ItemType[] = ["EPIC", "STORY", "TASK", "BUG", "SUBTASK"];
const PRIORITIES: ItemPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const MEMBER_ROLES: Exclude<ProjectRole, "ADMIN">[] = ["SCRUM_MASTER", "PRODUCT_OWNER", "DEVELOPER", "OBSERVER"];

const STATUS_TONE: Record<ItemStatus, string> = {
  TODO: "border-slate-400/25 bg-slate-400/10 text-slate-700 dark:text-slate-200",
  IN_PROGRESS: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300",
  IN_REVIEW: "border-violet-400/30 bg-violet-400/10 text-violet-700 dark:text-violet-300",
  DONE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  BLOCKED: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300",
};
const PRIORITY_TONE: Record<ItemPriority, string> = {
  LOW: "text-emerald-700 dark:text-emerald-300", MEDIUM: "text-sky-700 dark:text-sky-300", HIGH: "text-amber-700 dark:text-amber-300", URGENT: "text-rose-700 dark:text-rose-300",
};
const PANEL = "rounded-2xl border border-line/80 bg-surface shadow-[0_12px_30px_rgb(0_0_0_/_0.12)]";
const FIELD = "w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-2 focus:ring-accent/15";
const BUTTON = "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";
const GHOST = "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-muted transition hover:border-accent/40 hover:bg-surface-2 hover:text-fg disabled:opacity-50";

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDays(value: string, days: number) {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function prettyError(error: unknown, fallback: string) {
  const serverMessage = getServerDetail(error);
  if (serverMessage) return serverMessage;
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (typeof detail === "object" && detail !== null && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return fallback;
}
function roleCanPlan(role?: ProjectRole) {
  return role === "ADMIN" || role === "SCRUM_MASTER" || role === "PRODUCT_OWNER";
}
function roleCanEdit(role?: ProjectRole) {
  return roleCanPlan(role) || role === "DEVELOPER";
}

export default function AdminAgileProjects() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [view, setView] = useState<View>("overview");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ key: "", name: "", description: "", sprint_length_weeks: 2 });
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgileItem | null>(null);
  const [itemForm, setItemForm] = useState<AgileItemInput>({
    title: "", description: "", acceptance_criteria: "", item_type: "STORY", status: "TODO",
    priority: "MEDIUM", assigned_role: null, estimate_points: null, epic_id: null, assignee_id: null, sprint_id: null, due_date: null,
  });
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "ALL">("ALL");
  const [epicFilter, setEpicFilter] = useState<string>("ALL");
  const [sprintFilter, setSprintFilter] = useState<string>("ACTIVE");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [backlogDraggedId, setBacklogDraggedId] = useState<number | null>(null);
  const [sprintForm, setSprintForm] = useState({ name: "", goal: "", start_date: dateStr(), end_date: plusDays(dateStr(), 13) });
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<ProjectRole, "ADMIN">>("DEVELOPER");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"file" | "google">("file");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const projectsQuery = useQuery({ queryKey: ["agile", "projects"], queryFn: fetchAgileProjects });
  const project = projectsQuery.data?.find((p) => p.id === selectedProjectId) ?? null;
  const itemsQuery = useQuery({ queryKey: ["agile", selectedProjectId, "items"], queryFn: () => fetchAgileItems(selectedProjectId!), enabled: selectedProjectId !== null });
  const sprintsQuery = useQuery({ queryKey: ["agile", selectedProjectId, "sprints"], queryFn: () => fetchAgileSprints(selectedProjectId!), enabled: selectedProjectId !== null });
  const membersQuery = useQuery({ queryKey: ["agile", selectedProjectId, "members"], queryFn: () => fetchAgileMembers(selectedProjectId!), enabled: selectedProjectId !== null });
  const staffQuery = useQuery({ queryKey: ["agile", "staff"], queryFn: fetchAgileStaff, enabled: selectedProjectId !== null });
  const commentsQuery = useQuery({ queryKey: ["agile", selectedProjectId, detailItemId, "comments"], queryFn: () => fetchAgileComments(selectedProjectId!, detailItemId!), enabled: selectedProjectId !== null && detailItemId !== null });
  const historyQuery = useQuery({ queryKey: ["agile", selectedProjectId, detailItemId, "history"], queryFn: () => fetchAgileHistory(selectedProjectId!, detailItemId!), enabled: selectedProjectId !== null && detailItemId !== null });

  const items = itemsQuery.data ?? [];
  const sprints = sprintsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const visibleItems = useMemo(() => items.filter((item) => {
    const haystack = `${item.key} ${item.title} ${item.description} ${item.assignee_name ?? ""} ${item.epic_title ?? ""}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (typeFilter === "ALL" || item.item_type === typeFilter)
      && (epicFilter === "ALL" || String(item.epic_id ?? "NONE") === epicFilter);
  }), [items, query, typeFilter, epicFilter]);
  const epics = useMemo(() => items.filter((item) => item.item_type === "EPIC"), [items]);
  const activeSprint = sprints.find((s) => s.status === "ACTIVE") ?? null;
  const detailItem = items.find((item) => item.id === detailItemId) ?? null;
  const projectWritable = project?.status !== "ARCHIVED" || project?.my_role === "ADMIN";
  const planPermission = projectWritable && roleCanPlan(project?.my_role);
  const editPermission = projectWritable && roleCanEdit(project?.my_role);

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ["agile"] });
  }
  async function run<T>(operation: () => Promise<T>, successMessage = ""): Promise<T | undefined> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      await refreshAll();
      if (successMessage) setNotice(successMessage);
      return result;
    } catch (err) {
      setError(prettyError(err, t("agile.errors.generic")));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function submitProject(e: FormEvent) {
    e.preventDefault();
    const created = await run(() => createAgileProject({ ...projectForm, key: projectForm.key.toUpperCase().trim(), name: projectForm.name.trim(), description: projectForm.description.trim() }), t("agile.projectCreated"));
    if (created) {
      setSelectedProjectId(created.id);
      setView("overview");
      setShowProjectForm(false);
      setProjectForm({ key: "", name: "", description: "", sprint_length_weeks: 2 });
    }
  }
  function openNewItem(defaultType: ItemType = "STORY", defaultSprintId: number | null = null) {
    setEditingItem(null);
    setItemForm({ title: "", description: "", acceptance_criteria: "", item_type: defaultType, status: "TODO", priority: "MEDIUM", assigned_role: null, estimate_points: null, epic_id: null, assignee_id: null, sprint_id: defaultSprintId, due_date: null });
    setItemFormOpen(true);
  }
  function openEditItem(item: AgileItem) {
    setEditingItem(item);
    setItemForm({ title: item.title, description: item.description, acceptance_criteria: item.acceptance_criteria,
      item_type: item.item_type, status: item.status, priority: item.priority, assigned_role: item.assigned_role,
      estimate_points: item.estimate_points, epic_id: item.epic_id, assignee_id: item.assignee_id,
      sprint_id: item.sprint_id, due_date: item.due_date });
    setItemFormOpen(true);
  }
  async function submitItem(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;
    const payload = { ...itemForm, title: itemForm.title.trim(), description: itemForm.description.trim(), acceptance_criteria: itemForm.acceptance_criteria.trim(), epic_id: itemForm.item_type === "EPIC" ? null : itemForm.epic_id };
    const saved = editingItem
      ? await run(() => updateAgileItem(selectedProjectId, editingItem.id, payload), t("agile.itemUpdated"))
      : await run(() => createAgileItem(selectedProjectId, payload), t("agile.itemCreated"));
    if (saved) {
      setItemFormOpen(false);
      setEditingItem(null);
      if (!editingItem) setDetailItemId(saved.id);
    }
  }
  async function moveItem(item: AgileItem, status: ItemStatus) {
    if (!selectedProjectId || !editPermission) return;
    const targetItems = items.filter((candidate) =>
      candidate.id !== item.id && !candidate.is_archived && candidate.item_type !== "EPIC"
      && candidate.sprint_id === item.sprint_id && candidate.status === status
    );
    const order_index = targetItems.reduce((max, candidate) => Math.max(max, candidate.order_index), -1) + 1;
    if (item.status === status && item.order_index === order_index) return;
    await run(() => updateAgileItem(selectedProjectId, item.id, { status, order_index }), t("agile.itemMoved"));
  }
  async function reorderBacklogBefore(targetId: number) {
    if (!selectedProjectId || !editPermission || backlogDraggedId === null || backlogDraggedId === targetId) {
      setBacklogDraggedId(null);
      return;
    }
    const ordered = items.filter((item) => !item.is_archived && !item.sprint_id && item.item_type !== "EPIC")
      .sort((a, b) => a.order_index - b.order_index || a.id - b.id);
    const from = ordered.findIndex((item) => item.id === backlogDraggedId);
    const [dragged] = ordered.splice(from, 1);
    const targetIndex = ordered.findIndex((item) => item.id === targetId);
    if (!dragged || from < 0 || targetIndex < 0) {
      setBacklogDraggedId(null);
      return;
    }
    ordered.splice(targetIndex, 0, dragged);
    await run(() => reorderAgileBacklog(selectedProjectId, ordered.map((item) => item.id)), t("agile.backlogReordered"));
    setBacklogDraggedId(null);
  }
  async function archiveItem(item: AgileItem) {
    if (!selectedProjectId || !window.confirm(t("agile.confirmArchive", { key: item.key }))) return;
    const archived = await run(async () => { await archiveAgileItem(selectedProjectId, item.id); return true; }, t("agile.itemArchived"));
    if (archived) setDetailItemId(null);
  }
  function openSprintForm() {
    const start = dateStr();
    const lengthWeeks = project?.sprint_length_weeks ?? 2;
    setSprintForm({ name: "", goal: "", start_date: start, end_date: plusDays(start, lengthWeeks * 7 - 1) });
    setShowSprintForm(true);
  }
  async function submitSprint(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;
    const result = await run(() => createAgileSprint(selectedProjectId, sprintForm), t("agile.sprintCreated"));
    if (result) {
      setShowSprintForm(false);
      setSprintForm({ name: "", goal: "", start_date: dateStr(), end_date: plusDays(dateStr(), (project?.sprint_length_weeks ?? 2) * 7 - 1) });
    }
  }
  async function closeSprint(sprint: AgileSprint, carry: boolean) {
    if (!selectedProjectId) return;
    const copy = carry ? t("agile.confirmCarry", { name: sprint.name }) : t("agile.confirmBacklog", { name: sprint.name });
    if (!window.confirm(copy)) return;
    await run(() => completeAgileSprint(selectedProjectId, sprint.id, carry), carry ? t("agile.sprintCarryCompleted") : t("agile.sprintBacklogCompleted"));
  }
  async function submitMember(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !memberUserId) return;
    const result = await run(() => upsertAgileMember(selectedProjectId, Number(memberUserId), memberRole), t("agile.memberSaved"));
    if (result) setMemberUserId("");
  }
  async function submitImportPreview() {
    if (!selectedProjectId) return;
    if (importMode === "file" && !importFile) return;
    if (importMode === "google" && !googleSheetUrl.trim()) return;
    const result = await run(() => importMode === "google"
      ? previewAgileGoogleImport(selectedProjectId, googleSheetUrl.trim())
      : previewAgileImport(selectedProjectId, importFile!), t("agile.previewReady"));
    if (result) setImportPreview(result);
  }
  async function submitImportCommit() {
    if (!selectedProjectId || !importPreview || importPreview.error_rows > 0) return;
    if (importMode === "file" && !importFile) return;
    if (importMode === "google" && !googleSheetUrl.trim()) return;
    const result = await run(() => importMode === "google"
      ? commitAgileGoogleImport(selectedProjectId, googleSheetUrl.trim(), duplicateStrategy)
      : commitAgileImport(selectedProjectId, importFile!, duplicateStrategy), t("agile.importDone"));
    if (result) { setImportPreview(null); setImportFile(null); setGoogleSheetUrl(""); }
  }
  async function postComment(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !detailItemId || !commentDraft.trim()) return;
    const result = await run(() => addAgileComment(selectedProjectId, detailItemId, commentDraft.trim()), t("agile.commentAdded"));
    if (result) setCommentDraft("");
  }

  const viewTabs: Array<{ id: View; label: string; icon: typeof FolderKanban }> = [
    { id: "overview", label: t("agile.views.overview"), icon: Activity },
    { id: "backlog", label: t("agile.views.backlog"), icon: ListTodo },
    { id: "board", label: t("agile.views.board"), icon: Columns3 },
    { id: "epics", label: t("agile.views.epics"), icon: Layers },
    { id: "sprints", label: t("agile.views.sprints"), icon: Zap },
    { id: "timeline", label: t("agile.views.timeline"), icon: CalendarDays },
    { id: "team", label: t("agile.views.team"), icon: Users },
    { id: "import", label: t("agile.views.import"), icon: FileSpreadsheet },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
      {!selectedProjectId || !project ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent"><Sparkles className="h-3.5 w-3.5" /> AJR DATA · WORKSPACE</p>
              <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t("agile.title")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-fg-muted">{t("agile.subtitle")}</p>
            </div>
            <button type="button" className={BUTTON} onClick={() => setShowProjectForm((v) => !v)}><Plus className="h-4 w-4" /> {t("agile.newProject")}</button>
          </div>
          {error && <Alert kind="error" text={error} onClose={() => setError("")} />}
          {notice && <Alert kind="success" text={notice} onClose={() => setNotice("")} />}
          {showProjectForm && <form onSubmit={submitProject} className={`${PANEL} grid gap-4 p-5 sm:grid-cols-2`}>
            <div className="sm:col-span-2"><h2 className="text-lg font-semibold text-fg">{t("agile.createProjectTitle")}</h2><p className="text-sm text-fg-muted">{t("agile.createProjectHint")}</p></div>
            <Field label={t("agile.projectKey")} hint={t("agile.projectKeyHint")}><input className={FIELD} value={projectForm.key} maxLength={10} onChange={(e) => setProjectForm({ ...projectForm, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="AJR" pattern="[A-Z][A-Z0-9]{1,9}" required /></Field>
            <Field label={t("agile.projectName")}><input className={FIELD} value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} maxLength={140} required /></Field>
            <Field label={t("agile.defaultSprintLength")}><select className={FIELD} value={projectForm.sprint_length_weeks} onChange={(e) => setProjectForm({ ...projectForm, sprint_length_weeks: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? t("agile.week") : t("agile.weeks")}</option>)}</select></Field>
            <Field label={t("agile.description")}><textarea className={FIELD} rows={3} maxLength={5000} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></Field>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" className={GHOST} onClick={() => setShowProjectForm(false)}>{t("agile.cancel")}</button><button type="submit" disabled={busy} className={BUTTON}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{t("agile.createProject")}</button></div>
          </form>}
          {projectsQuery.isLoading && <Loading text={t("agile.loadingProjects")} />}
          {projectsQuery.isError && <Alert kind="error" text={t("agile.errors.loadProjects")} onClose={() => void projectsQuery.refetch()} actionLabel={t("agile.retry")} />}
          {!!projectsQuery.data?.length && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projectsQuery.data.map((p) => <button key={p.id} type="button" onClick={() => { setSelectedProjectId(p.id); setView("overview"); setError(""); setNotice(""); }} className={`${PANEL} group relative overflow-hidden p-5 text-left transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_18px_45px_rgb(20_90_220_/_0.12)]`}>
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 opacity-70 transition group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-gradient-to-br from-accent/15 to-violet-500/10 text-accent"><FolderKanban className="h-5 w-5" /></span><span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", p.status === "ACTIVE" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : "border-line text-fg-subtle")}>{t(`agile.projectStatus.${p.status}`)}</span></div>
              <div className="mt-4 flex items-center gap-2"><span className="rounded-md bg-brand/10 px-2 py-1 font-mono text-xs font-bold text-accent">{p.key}</span><span className="text-xs text-fg-subtle">{t(`agile.roles.${p.my_role}`)}</span></div>
              <h2 className="mt-2 text-lg font-semibold text-fg group-hover:text-accent">{p.name}</h2><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-fg-muted">{p.description || t("agile.noDescription")}</p>
              <div className="mt-5 flex items-center justify-between border-t border-line/70 pt-4"><div><p className="text-xs text-fg-subtle">{t("agile.completedWork")}</p><p className="mt-0.5 text-sm font-semibold text-fg">{p.completed_items} / {p.total_items}</p></div><div className="w-28"><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${p.total_items ? Math.round(p.completed_items / p.total_items * 100) : 0}%` }} /></div><p className="mt-1 text-right text-[11px] text-fg-subtle">{p.total_items ? Math.round(p.completed_items / p.total_items * 100) : 0}%</p></div><ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-1 group-hover:text-accent" /></div>
              {p.active_sprint_name && <p className="mt-3 flex items-center gap-2 text-xs text-fg-muted"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{t("agile.activeSprint")}: {p.active_sprint_name}</p>}
            </button>)}
          </div>}
          {!projectsQuery.isLoading && projectsQuery.data?.length === 0 && <div className={`${PANEL} flex flex-col items-center px-6 py-14 text-center`}><span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/5 text-accent"><FolderKanban className="h-7 w-7" /></span><h2 className="mt-4 text-lg font-semibold text-fg">{t("agile.emptyProjects")}</h2><p className="mt-1 max-w-md text-sm text-fg-muted">{t("agile.emptyProjectsHint")}</p><button className={`${BUTTON} mt-5`} onClick={() => setShowProjectForm(true)}><Plus className="h-4 w-4" />{t("agile.newProject")}</button></div>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted"><button className="inline-flex items-center gap-1.5 transition hover:text-accent" onClick={() => { setSelectedProjectId(null); setDetailItemId(null); }}><ArrowLeft className="h-4 w-4" /> {t("agile.allProjects")}</button><span className="text-fg-subtle">/</span><span className="font-mono text-xs font-bold text-accent">{project.key}</span><span className="text-fg">{project.name}</span></div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{t("agile.workspaceLabel")}</p><span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-subtle">{t(`agile.roles.${project.my_role}`)}</span></div><h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-fg">{project.name}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-fg-muted">{project.description || t("agile.noDescription")}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" className={GHOST} onClick={() => void refreshAll()} disabled={busy}><RefreshCw className="h-4 w-4" />{t("agile.refresh")}</button>{editPermission && <button type="button" className={BUTTON} onClick={() => openNewItem()}><Plus className="h-4 w-4" />{t("agile.newCard")}</button>}</div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto border-b border-line pb-1 [scrollbar-width:thin]">
            {viewTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} className={cn("relative inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3 py-3 text-sm font-medium transition", view === id ? "bg-accent/10 text-accent after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}><Icon className="h-4 w-4" />{label}{id === "backlog" && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px]">{items.filter((x) => !x.sprint_id && x.item_type !== "EPIC").length}</span>}</button>)}
          </div>
          {error && <Alert kind="error" text={error} onClose={() => setError("")} />}{notice && <Alert kind="success" text={notice} onClose={() => setNotice("")} />}
          {(itemsQuery.isLoading || sprintsQuery.isLoading || membersQuery.isLoading) && <Loading text={t("agile.loadingWorkspace")} />}
          {(itemsQuery.isError || sprintsQuery.isError || membersQuery.isError) && <Alert kind="error" text={t("agile.errors.loadWorkspace")} onClose={() => void refreshAll()} actionLabel={t("agile.retry")} />}

          <div className={cn(view !== "overview" && "hidden")}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={ListTodo} label={t("agile.metrics.backlog")} value={items.filter((i) => !i.sprint_id && i.item_type !== "EPIC" && !i.is_archived).length} detail={t("agile.metrics.backlogHint")} />
              <Metric icon={Zap} label={t("agile.metrics.activeSprint")} value={activeSprint?.name ?? t("agile.noActiveSprint")} detail={activeSprint ? `${dateLabel(activeSprint.start_date)} — ${dateLabel(activeSprint.end_date)}` : t("agile.metrics.activeSprintHint")} />
              <Metric icon={CheckCheck} label={t("agile.metrics.completed")} value={`${items.filter((i) => i.status === "DONE" && !i.is_archived).length}/${items.filter((i) => !i.is_archived && i.item_type !== "EPIC").length}`} detail={t("agile.metrics.completedHint")} />
              <Metric icon={Users} label={t("agile.metrics.team")} value={members.length} detail={t("agile.metrics.teamHint")} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <section className={`${PANEL} p-5`}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-fg">{t("agile.activeSprintPanel")}</h2><p className="mt-1 text-sm text-fg-muted">{t("agile.activeSprintPanelHint")}</p></div><span className="rounded-xl border border-accent/20 bg-accent/5 p-2 text-accent"><Activity className="h-5 w-5" /></span></div>
                {activeSprint ? <><div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xl font-bold text-fg">{activeSprint.name}</p><p className="mt-1 text-sm text-fg-muted">{activeSprint.goal || t("agile.noSprintGoal")}</p></div><span className="text-xs text-fg-subtle">{dateLabel(activeSprint.start_date)} – {dateLabel(activeSprint.end_date)}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all" style={{ width: `${activeSprint.total_items ? (activeSprint.completed_items / activeSprint.total_items) * 100 : 0}%` }} /></div><div className="mt-2 flex justify-between text-xs text-fg-muted"><span>{activeSprint.completed_items} / {activeSprint.total_items} {t("agile.cardsComplete")}</span><span>{activeSprint.completed_points} / {activeSprint.total_points} pts</span></div><button className={`${GHOST} mt-4`} onClick={() => setView("board")}>{t("agile.openBoard")} <ArrowRight className="h-4 w-4" /></button></> : <EmptyInline text={t("agile.noActiveSprintHint")} action={planPermission ? t("agile.createSprint") : undefined} onAction={() => { setView("sprints"); openSprintForm(); }} />}
              </section>
              <section className={`${PANEL} p-5`}><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-fg">{t("agile.recentItems")}</h2><p className="mt-1 text-sm text-fg-muted">{t("agile.recentItemsHint")}</p></div><button className="text-sm font-medium text-accent hover:underline" onClick={() => setView("backlog")}>{t("agile.seeBacklog")}</button></div><div className="mt-4 space-y-2">{[...items].filter((i) => !i.is_archived && i.item_type !== "EPIC").sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,5).map((item) => <CompactItem key={item.id} item={item} onClick={() => setDetailItemId(item.id)} t={t} />)}{items.filter((i) => i.item_type !== "EPIC" && !i.is_archived).length === 0 && <EmptyInline text={t("agile.noItemsYet")} action={editPermission ? t("agile.createFirstCard") : undefined} onAction={() => openNewItem()} />}</div></section>
            </div>
          </div>

          <div className={cn(view !== "backlog" && "hidden")}>
            <ViewIntro title={t("agile.backlogTitle")} desc={t("agile.backlogDesc")} action={editPermission ? t("agile.newCard") : undefined} onAction={() => openNewItem()} />
            <Filters query={query} setQuery={setQuery} typeFilter={typeFilter} setTypeFilter={setTypeFilter} epicFilter={epicFilter} setEpicFilter={setEpicFilter} epics={epics} t={t} />
            {editPermission && <p className="mt-3 text-xs text-fg-subtle">{t("agile.reorderBacklogHint")}</p>}
            <div className={`${PANEL} mt-4 overflow-hidden`}><div className="grid grid-cols-[minmax(0,1.5fr)_110px_140px_140px_64px] gap-3 border-b border-line bg-surface-2/70 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-fg-subtle max-md:hidden"><span>{t("agile.table.card")}</span><span>{t("agile.table.priority")}</span><span>{t("agile.table.epic")}</span><span>{t("agile.table.assignee")}</span><span>{t("agile.table.points")}</span></div>
              {visibleItems.filter((i) => !i.sprint_id && i.item_type !== "EPIC" && !i.is_archived).map((item) => <div key={item.id} draggable={editPermission} onDragStart={(e) => { if (!editPermission) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(item.id)); setBacklogDraggedId(item.id); }} onDragOver={(e) => { if (editPermission) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={(e) => { e.preventDefault(); void reorderBacklogBefore(item.id); }} onDragEnd={() => setBacklogDraggedId(null)} className={cn("grid gap-2 border-b border-line/60 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.5fr)_110px_140px_140px_64px] md:items-center md:gap-3 hover:bg-surface-2/40", editPermission && "cursor-grab active:cursor-grabbing", backlogDraggedId === item.id && "opacity-40")}><button className="min-w-0 text-left" onClick={() => setDetailItemId(item.id)}><span className="font-mono text-[10px] font-bold text-accent">{item.key}</span><span className="ml-2 text-sm font-semibold text-fg">{item.title}</span><p className="mt-1 truncate text-xs text-fg-muted">{item.description || t("agile.noDescription")}</p></button><span className={cn("text-xs font-semibold", PRIORITY_TONE[item.priority])}>{t(`agile.priorities.${item.priority}`)}</span><span className="truncate text-xs text-fg-muted">{item.epic_title || "—"}</span><span className="truncate text-xs text-fg-muted">{item.assignee_name || item.assignee_email || t("agile.unassigned")}</span><span className="text-xs text-fg-muted">{item.estimate_points ?? "—"}</span></div>)}
              {visibleItems.filter((i) => !i.sprint_id && i.item_type !== "EPIC" && !i.is_archived).length === 0 && <div className="p-8"><EmptyInline text={t("agile.emptyBacklog")} action={editPermission ? t("agile.newCard") : undefined} onAction={() => openNewItem()} /></div>}
            </div>
          </div>

          <div className={cn(view !== "board" && "hidden")}>
            <ViewIntro title={t("agile.boardTitle")} desc={t("agile.boardDesc")} action={editPermission ? t("agile.newCard") : undefined} onAction={() => openNewItem()} />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><Filters query={query} setQuery={setQuery} typeFilter={typeFilter} setTypeFilter={setTypeFilter} epicFilter={epicFilter} setEpicFilter={setEpicFilter} epics={epics} t={t} compact /><Field label={t("agile.filterSprint")}><select className={`${FIELD} min-w-[190px]`} value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}><option value="ACTIVE">{t("agile.activeSprintOnly")}</option><option value="BACKLOG">{t("agile.backlogOnly")}</option><option value="ALL">{t("agile.allItems")}</option>{sprints.filter((s) => s.status !== "COMPLETED").map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select></Field></div>
            <div className="grid gap-3 lg:grid-cols-5">
              {STATUSES.map((status) => {
                const colItems = visibleItems.filter((i) => i.item_type !== "EPIC" && !i.is_archived && i.status === status && (sprintFilter === "ACTIVE" ? i.sprint_id === activeSprint?.id : sprintFilter === "BACKLOG" ? !i.sprint_id : sprintFilter === "ALL" ? true : i.sprint_id === Number(sprintFilter)));
                return <section key={status} onDragOver={(e) => { if (editPermission) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const dragged = items.find((i) => i.id === draggedId); if (dragged) void moveItem(dragged, status); setDraggedId(null); }} className={cn("min-h-[350px] rounded-2xl border border-line/80 bg-surface/65 p-2.5 transition", draggedId && "border-accent/30 bg-accent/5")}>
                  <div className="mb-3 flex items-center justify-between gap-2 px-1 pt-1"><div className="flex min-w-0 items-center gap-2"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", status === "TODO" ? "bg-slate-400" : status === "IN_PROGRESS" ? "bg-sky-400" : status === "IN_REVIEW" ? "bg-violet-400" : status === "DONE" ? "bg-emerald-400" : "bg-rose-400")} /><h3 className="truncate text-xs font-bold uppercase tracking-wide text-fg-muted">{t(`agile.statuses.${status}`)}</h3></div><span className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold text-fg-subtle">{colItems.length}</span></div>
                  <div className="space-y-2">{colItems.map((item) => <BoardCard key={item.id} item={item} canEdit={editPermission} onDragStart={() => setDraggedId(item.id)} onOpen={() => setDetailItemId(item.id)} onEdit={() => openEditItem(item)} onStatus={(next) => void moveItem(item, next)} t={t} />)}
                    {colItems.length === 0 && <div className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-line px-3 text-center text-xs text-fg-subtle">{t("agile.dropHere")}</div>}
                  </div>
                  {editPermission && <button className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line px-2 py-2 text-xs text-fg-subtle transition hover:border-accent/40 hover:text-accent" onClick={() => { openNewItem("STORY", activeSprint?.id ?? null); setItemForm((old) => ({ ...old, status })); }}><Plus className="h-3.5 w-3.5" />{t("agile.addCard")}</button>}
                </section>;
              })}
            </div>
          </div>

          <div className={cn(view !== "epics" && "hidden")}>
            <ViewIntro title={t("agile.epicsTitle")} desc={t("agile.epicsDesc")} action={editPermission ? t("agile.newEpic") : undefined} onAction={() => openNewItem("EPIC")} />
            <div className="mt-4 space-y-3">{epics.map((epic) => { const children = items.filter((i) => i.epic_id === epic.id && !i.is_archived); const done = children.filter((i) => i.status === "DONE").length; return <section key={epic.id} className={`${PANEL} overflow-hidden`}><div className="flex flex-col gap-3 border-b border-line/70 bg-gradient-to-r from-accent/5 via-transparent to-violet-500/5 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/5 text-accent"><Layers className="h-5 w-5" /></span><div className="min-w-0"><p className="font-mono text-[10px] font-bold text-accent">{epic.key}</p><button className="mt-0.5 text-left text-base font-semibold text-fg hover:text-accent" onClick={() => setDetailItemId(epic.id)}>{epic.title}</button><p className="mt-1 text-sm text-fg-muted">{epic.description || t("agile.noDescription")}</p></div></div><div className="flex shrink-0 items-center gap-2"><span className={cn("rounded-full border px-2.5 py-1 text-xs", STATUS_TONE[epic.status])}>{t(`agile.statuses.${epic.status}`)}</span>{editPermission && <button className={GHOST} onClick={() => openEditItem(epic)}>{t("agile.edit")}</button>}</div></div><div className="px-4 py-3"><div className="mb-3 flex items-center justify-between text-xs text-fg-muted"><span>{children.length} {t("agile.storiesInEpic")}</span><span>{done}/{children.length} · {children.length ? Math.round(done / children.length * 100) : 0}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${children.length ? done / children.length * 100 : 0}%` }} /></div>{children.length > 0 && <div className="mt-3 divide-y divide-line/60">{children.map((child) => <button key={child.id} className="flex w-full items-center gap-2 py-2 text-left hover:text-accent" onClick={() => setDetailItemId(child.id)}><span className="font-mono text-[10px] text-fg-subtle">{child.key}</span><span className="min-w-0 flex-1 truncate text-sm text-fg">{child.title}</span><span className={cn("rounded-full border px-2 py-0.5 text-[10px]", STATUS_TONE[child.status])}>{t(`agile.statuses.${child.status}`)}</span></button>)}</div>}</div></section>; })}
              {epics.length === 0 && <div className={`${PANEL} p-8`}><EmptyInline text={t("agile.noEpics")} action={editPermission ? t("agile.createEpic") : undefined} onAction={() => openNewItem("EPIC")} /></div>}
            </div>
          </div>

          <div className={cn(view !== "sprints" && "hidden")}>
            <ViewIntro title={t("agile.sprintsTitle")} desc={t("agile.sprintsDesc")} action={planPermission ? t("agile.createSprint") : undefined} onAction={() => { if (showSprintForm) setShowSprintForm(false); else openSprintForm(); }} />
            {showSprintForm && planPermission && <form onSubmit={submitSprint} className={`${PANEL} mt-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4`}><Field label={t("agile.sprintName")}><input className={FIELD} value={sprintForm.name} onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })} required maxLength={120} placeholder={t("agile.sprintNamePlaceholder", { count: sprints.length + 1 })} /></Field><Field label={t("agile.sprintStart")}><input className={FIELD} type="date" value={sprintForm.start_date} onChange={(e) => setSprintForm({ ...sprintForm, start_date: e.target.value, end_date: plusDays(e.target.value, (project.sprint_length_weeks * 7) - 1) })} required /></Field><Field label={t("agile.sprintEnd")}><input className={FIELD} type="date" value={sprintForm.end_date} onChange={(e) => setSprintForm({ ...sprintForm, end_date: e.target.value })} min={plusDays(sprintForm.start_date, 6)} max={plusDays(sprintForm.start_date, 27)} required /></Field><Field label={t("agile.sprintGoal")}><input className={FIELD} value={sprintForm.goal} onChange={(e) => setSprintForm({ ...sprintForm, goal: e.target.value })} maxLength={3000} /></Field><div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-4"><button type="button" className={GHOST} onClick={() => setShowSprintForm(false)}>{t("agile.cancel")}</button><button type="submit" className={BUTTON} disabled={busy}><Plus className="h-4 w-4" />{t("agile.saveSprint")}</button></div></form>}
            <div className="mt-4 grid gap-4 xl:grid-cols-2">{[...sprints].sort((a,b) => b.start_date.localeCompare(a.start_date)).map((sprint) => <section key={sprint.id} className={`${PANEL} overflow-hidden`}><div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 p-4"><div className="flex min-w-0 gap-3"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", sprint.status === "ACTIVE" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : "border-line bg-surface-2 text-fg-muted")}><Zap className="h-5 w-5" /></span><div><h3 className="font-semibold text-fg">{sprint.name}</h3><p className="mt-1 text-xs text-fg-muted">{dateLabel(sprint.start_date)} — {dateLabel(sprint.end_date)}</p><p className="mt-1 text-sm text-fg-muted">{sprint.goal || t("agile.noSprintGoal")}</p></div></div><span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", sprint.status === "ACTIVE" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : sprint.status === "COMPLETED" ? "border-line bg-surface-2 text-fg-subtle" : "border-accent/20 bg-accent/5 text-accent")}>{t(`agile.sprintStatus.${sprint.status}`)}</span></div><div className="p-4"><div className="flex justify-between text-xs text-fg-muted"><span>{sprint.completed_items}/{sprint.total_items} {t("agile.cardsComplete")}</span><span>{sprint.completed_points}/{sprint.total_points} pts</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${sprint.total_items ? sprint.completed_items / sprint.total_items * 100 : 0}%` }} /></div>{planPermission && <div className="mt-4 flex flex-wrap gap-2">{sprint.status === "PLANNED" && <button disabled={busy || Boolean(activeSprint)} className={BUTTON} onClick={() => void run(() => startAgileSprint(project.id, sprint.id), t("agile.sprintStarted"))}><Zap className="h-4 w-4" />{t("agile.startSprint")}</button>}{sprint.status === "ACTIVE" && <><button disabled={busy} className={BUTTON} onClick={() => void closeSprint(sprint, true)}><ArrowRight className="h-4 w-4" />{t("agile.finishCarry")}</button><button disabled={busy} className={GHOST} onClick={() => void closeSprint(sprint, false)}>{t("agile.finishBacklog")}</button></>}</div>}</div></section>)}{sprints.length === 0 && <div className={`${PANEL} p-8 xl:col-span-2`}><EmptyInline text={t("agile.noSprints")} action={planPermission ? t("agile.createSprint") : undefined} onAction={openSprintForm} /></div>}</div>
          </div>

          <div className={cn(view !== "timeline" && "hidden")}>
            <ViewIntro title={t("agile.timelineTitle")} desc={t("agile.timelineDesc")} />
            <div className={`${PANEL} mt-4 overflow-hidden p-5`}><div className="relative space-y-5 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-gradient-to-b before:from-cyan-400/80 before:via-blue-500/50 before:to-violet-500/10">{[...sprints].sort((a,b) => a.start_date.localeCompare(b.start_date)).map((sprint) => <div key={sprint.id} className="relative pl-9"><span className={cn("absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-app", sprint.status === "ACTIVE" ? "border-emerald-400" : sprint.status === "COMPLETED" ? "border-violet-400" : "border-accent")}><span className="h-1 w-1 rounded-full bg-current" /></span><div className="rounded-xl border border-line/80 bg-surface-2/40 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-fg">{sprint.name}</h3><p className="mt-1 text-xs text-fg-muted">{dateLabel(sprint.start_date)} — {dateLabel(sprint.end_date)}</p></div><span className="rounded-full border border-line px-2 py-1 text-[10px] text-fg-muted">{t(`agile.sprintStatus.${sprint.status}`)}</span></div><p className="mt-2 text-sm text-fg-muted">{sprint.goal || t("agile.noSprintGoal")}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-fg-subtle"><span>{sprint.total_items} {t("agile.cards")}</span><span>{sprint.total_points} pts</span><span>{sprint.completed_items} {t("agile.completedLabel")}</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${sprint.total_items ? sprint.completed_items / sprint.total_items * 100 : 0}%` }} /></div></div></div>)}{items.filter((i) => !i.sprint_id && i.item_type !== "EPIC" && i.due_date && !i.is_archived).length > 0 && <div className="relative pl-9"><span className="absolute left-1 top-1 h-4 w-4 rounded-full border-2 border-amber-400 bg-app" /><div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><h3 className="font-semibold text-fg">{t("agile.unscheduledDueDates")}</h3>{items.filter((i) => !i.sprint_id && i.item_type !== "EPIC" && i.due_date && !i.is_archived).map((item) => <button key={item.id} className="mt-2 flex w-full flex-wrap items-center gap-2 text-left text-sm hover:text-accent" onClick={() => setDetailItemId(item.id)}><span className="font-mono text-[10px] text-accent">{item.key}</span><span className="flex-1">{item.title}</span><span className="text-xs text-fg-muted">{dateLabel(item.due_date)}</span></button>)}</div></div>}{sprints.length === 0 && <p className="pl-9 text-sm text-fg-muted">{t("agile.noTimeline")}</p>}</div></div>
          </div>

          <div className={cn(view !== "team" && "hidden")}>
            <ViewIntro title={t("agile.teamTitle")} desc={t("agile.teamDesc")} />
            {planPermission && <form onSubmit={submitMember} className={`${PANEL} mt-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto] sm:items-end`}><Field label={t("agile.teamUser")}><select className={FIELD} value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} required><option value="">{t("agile.selectStaff")}</option>{staff.filter((user) => !members.some((m) => m.user_id === user.id)).map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.email}</option>)}</select></Field><Field label={t("agile.teamRole")}><select className={FIELD} value={memberRole} onChange={(e) => setMemberRole(e.target.value as Exclude<ProjectRole, "ADMIN">)}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`agile.roles.${r}`)}</option>)}</select></Field><button className={BUTTON} disabled={busy || !memberUserId}><Plus className="h-4 w-4" />{t("agile.addMember")}</button></form>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{members.map((member) => <div key={member.id} className={`${PANEL} flex items-center gap-3 p-4`}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 to-violet-500/10 text-sm font-bold text-accent">{initials(member.full_name || member.email)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{member.full_name || member.email}</p><p className="truncate text-xs text-fg-muted">{member.email}</p>{planPermission ? <select aria-label={t("agile.teamRole")} className={`${FIELD} mt-2 py-1.5 text-xs`} value={member.role} disabled={busy} onChange={(e) => void run(() => upsertAgileMember(project.id, member.user_id, e.target.value as AgileMember["role"]), t("agile.memberSaved"))}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{t(`agile.roles.${r}`)}</option>)}</select> : <span className="mt-2 inline-flex rounded-full border border-line bg-surface-2 px-2 py-1 text-[10px] font-semibold text-fg-muted">{t(`agile.roles.${member.role}`)}</span>}</div>{planPermission && <button className="rounded-lg p-2 text-fg-subtle transition hover:bg-rose-400/10 hover:text-rose-700 dark:text-rose-300" aria-label={t("agile.removeMember")} title={t("agile.removeMember")} onClick={() => { if (window.confirm(t("agile.confirmRemoveMember", { name: member.full_name || member.email }))) void run(() => removeAgileMember(project.id, member.id), t("agile.memberRemoved")); }}><X className="h-4 w-4" /></button>}</div>)}{members.length === 0 && <div className={`${PANEL} p-8 sm:col-span-2 xl:col-span-3`}><EmptyInline text={t("agile.noMembers")} /></div>}</div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-fg-subtle"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t("agile.roleScopeHint")}</p>
          </div>

          <div className={cn(view !== "import" && "hidden")}>
            <ViewIntro title={t("agile.importTitle")} desc={t("agile.importDesc")} />
            <section className={`${PANEL} mt-4 p-5`}><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/5 text-emerald-700 dark:text-emerald-300"><FileSpreadsheet className="h-5 w-5" /></span><div><h2 className="font-semibold text-fg">{t("agile.importFileTitle")}</h2><p className="mt-1 text-sm leading-6 text-fg-muted">{t("agile.importFileHint")}</p></div></div>
              <div className="mt-5 inline-flex rounded-xl border border-line bg-app p-1"><button type="button" onClick={() => { setImportMode("file"); setImportPreview(null); }} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition", importMode === "file" ? "bg-brand text-white" : "text-fg-muted hover:text-fg")}>{t("agile.importFromFile")}</button><button type="button" onClick={() => { setImportMode("google"); setImportPreview(null); }} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition", importMode === "google" ? "bg-brand text-white" : "text-fg-muted hover:text-fg")}>{t("agile.importFromGoogle")}</button></div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">{importMode === "file" ? <Field label={t("agile.chooseFile")}><input className={`${FIELD} file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent`} type="file" accept=".csv,.xlsx,.xlsm" onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportPreview(null); }} /></Field> : <Field label={t("agile.googleSheetUrl")} hint={t("agile.googleSheetHint")}><input className={FIELD} type="url" value={googleSheetUrl} onChange={(e) => { setGoogleSheetUrl(e.target.value); setImportPreview(null); }} placeholder="https://docs.google.com/spreadsheets/d/…" required /></Field>}<Field label={t("agile.duplicatePolicy")}><select className={FIELD} value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value as "skip" | "update")}><option value="skip">{t("agile.skipDuplicates")}</option><option value="update">{t("agile.updateDuplicates")}</option></select></Field><button className={BUTTON} type="button" disabled={(importMode === "file" ? !importFile : !googleSheetUrl.trim()) || busy || !planPermission} onClick={() => void submitImportPreview()}><Search className="h-4 w-4" />{t("agile.previewImport")}</button></div>
              <p className="mt-3 text-xs leading-5 text-fg-subtle">{t("agile.importHeaders")}</p>
              {importPreview && <div className="mt-5 border-t border-line pt-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-fg">{t("agile.previewTitle", { name: importPreview.filename })}</h3><p className="mt-1 text-sm text-fg-muted">{t("agile.previewCounts", { total: importPreview.total_rows, valid: importPreview.valid_rows, errors: importPreview.error_rows })}</p></div><span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", importPreview.error_rows ? "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300")}>{importPreview.error_rows ? t("agile.needsFixes") : t("agile.readyToImport")}</span></div><div className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-line"><table className="min-w-[760px] w-full text-left text-xs"><thead className="sticky top-0 bg-surface-2 text-fg-subtle"><tr>{[t("agile.table.row"), t("agile.table.card"), t("agile.table.type"), t("agile.table.epic"), t("agile.table.priority"), t("agile.table.assignedRole"), t("agile.table.errors")].map((label) => <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-line/60">{importPreview.rows.map((row) => <tr key={row.row_number} className={row.errors.length ? "bg-rose-400/[0.035]" : ""}><td className="px-3 py-2.5 text-fg-subtle">{row.row_number}</td><td className="max-w-[280px] px-3 py-2.5"><p className="truncate font-medium text-fg">{row.title}</p><p className="mt-0.5 truncate text-fg-subtle">{row.description}</p></td><td className="px-3 py-2.5 text-fg-muted">{row.item_type}</td><td className="px-3 py-2.5 text-fg-muted">{row.epic || "—"}</td><td className="px-3 py-2.5 text-fg-muted">{row.priority}</td><td className="px-3 py-2.5 text-fg-muted">{row.assigned_role ? t(`agile.roles.${row.assigned_role}`) : "—"}</td><td className="max-w-[260px] px-3 py-2.5">{row.errors.length ? <span className="text-rose-700 dark:text-rose-300">{row.errors.join(" · ")}</span> : <span className="text-emerald-700 dark:text-emerald-300">{t("agile.validRow")}</span>}</td></tr>)}</tbody></table></div>{importPreview.truncated && <p className="mt-2 text-xs text-fg-subtle">{t("agile.previewTruncated")}</p>}<div className="mt-4 flex flex-wrap justify-end gap-2"><button className={GHOST} onClick={() => { setImportPreview(null); setImportFile(null); }}>{t("agile.cancel")}</button><button className={BUTTON} disabled={busy || importPreview.error_rows > 0 || importPreview.valid_rows === 0 || !planPermission} onClick={() => void submitImportCommit()}><Check className="h-4 w-4" />{t("agile.confirmImport")}</button></div></div>}
            </section>
          </div>
        </>
      )}

      {itemFormOpen && project && <Modal title={editingItem ? t("agile.editCardTitle", { key: editingItem.key }) : itemForm.item_type === "EPIC" ? t("agile.newEpic") : t("agile.newCard")} onClose={() => setItemFormOpen(false)}><form onSubmit={submitItem} className="grid gap-4 sm:grid-cols-2"><Field label={t("agile.cardTitle")}><input autoFocus className={FIELD} value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} required maxLength={240} /></Field><Field label={t("agile.cardType")}><select className={FIELD} value={itemForm.item_type} onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value as ItemType, epic_id: null })}>{TYPES.map((type) => <option key={type} value={type}>{t(`agile.types.${type}`)}</option>)}</select></Field><Field label={t("agile.cardStatus")}><select className={FIELD} value={itemForm.status} onChange={(e) => setItemForm({ ...itemForm, status: e.target.value as ItemStatus })}>{STATUSES.map((status) => <option key={status} value={status}>{t(`agile.statuses.${status}`)}</option>)}</select></Field><Field label={t("agile.cardPriority")}><select className={FIELD} value={itemForm.priority} onChange={(e) => setItemForm({ ...itemForm, priority: e.target.value as ItemPriority })}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{t(`agile.priorities.${priority}`)}</option>)}</select></Field><Field label={t("agile.assignedRole")} hint={t("agile.assignedRoleHint")}><select className={FIELD} value={itemForm.assigned_role ?? ""} onChange={(e) => setItemForm({ ...itemForm, assigned_role: (e.target.value || null) as AgileItemInput["assigned_role"] })}><option value="">{t("agile.noAssignedRole")}</option>{(["SCRUM_MASTER", "PRODUCT_OWNER", "DEVELOPER"] as const).map((role) => <option key={role} value={role}>{t(`agile.roles.${role}`)}</option>)}</select></Field><Field label={t("agile.cardEpic")}><select className={FIELD} disabled={itemForm.item_type === "EPIC"} value={itemForm.epic_id ?? ""} onChange={(e) => setItemForm({ ...itemForm, epic_id: e.target.value ? Number(e.target.value) : null })}><option value="">{t("agile.noEpic")}</option>{epics.filter((epic) => epic.id !== editingItem?.id).map((epic) => <option key={epic.id} value={epic.id}>{epic.key} · {epic.title}</option>)}</select></Field><Field label={t("agile.cardAssignee")}><select className={FIELD} value={itemForm.assignee_id ?? ""} onChange={(e) => setItemForm({ ...itemForm, assignee_id: e.target.value ? Number(e.target.value) : null })}><option value="">{t("agile.unassigned")}</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>)}</select></Field><Field label={t("agile.cardSprint")}><select className={FIELD} value={itemForm.sprint_id ?? ""} onChange={(e) => setItemForm({ ...itemForm, sprint_id: e.target.value ? Number(e.target.value) : null })}><option value="">{t("agile.backlog")}</option>{sprints.filter((sprint) => sprint.status !== "COMPLETED").map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {t(`agile.sprintStatus.${sprint.status}`)}</option>)}</select></Field><Field label={t("agile.storyPoints")}><input className={FIELD} type="number" min="0" max="1000" step="1" value={itemForm.estimate_points ?? ""} onChange={(e) => setItemForm({ ...itemForm, estimate_points: e.target.value === "" ? null : Number(e.target.value) })} /></Field><Field label={t("agile.dueDate")}><input className={FIELD} type="date" value={itemForm.due_date ?? ""} onChange={(e) => setItemForm({ ...itemForm, due_date: e.target.value || null })} /></Field><div className="sm:col-span-2"><Field label={t("agile.description")}><textarea className={FIELD} rows={3} maxLength={10000} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></Field></div>{itemForm.item_type === "STORY" && <div className="sm:col-span-2"><Field label={t("agile.acceptanceCriteria")}><textarea className={FIELD} rows={3} maxLength={10000} value={itemForm.acceptance_criteria} onChange={(e) => setItemForm({ ...itemForm, acceptance_criteria: e.target.value })} placeholder={t("agile.acceptancePlaceholder")} /></Field></div>}<div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2"><button type="button" className={GHOST} onClick={() => setItemFormOpen(false)}>{t("agile.cancel")}</button><button type="submit" disabled={busy} className={BUTTON}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{t("agile.saveCard")}</button></div></form></Modal>}

      {detailItem && project && <Modal title={detailItem.title} subtitle={`${detailItem.key} · ${t(`agile.types.${detailItem.item_type}`)}`} onClose={() => setDetailItemId(null)} wide><div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="space-y-4"><div className="flex flex-wrap gap-2"><span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", STATUS_TONE[detailItem.status])}>{t(`agile.statuses.${detailItem.status}`)}</span><span className={cn("rounded-full border border-line px-2.5 py-1 text-xs", PRIORITY_TONE[detailItem.priority])}>{t(`agile.priorities.${detailItem.priority}`)}</span>{detailItem.estimate_points !== null && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-fg-muted">{detailItem.estimate_points} pts</span>}{detailItem.assigned_role && <span className="rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-xs text-accent">{t(`agile.roles.${detailItem.assigned_role}`)}</span>}</div><div><h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-fg-subtle">{t("agile.description")}</h3><p className="whitespace-pre-wrap text-sm leading-6 text-fg-muted">{detailItem.description || t("agile.noDescription")}</p></div>{detailItem.acceptance_criteria && <div><h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-fg-subtle">{t("agile.acceptanceCriteria")}</h3><p className="whitespace-pre-wrap text-sm leading-6 text-fg-muted">{detailItem.acceptance_criteria}</p></div>}<div className="grid gap-3 rounded-xl border border-line/70 bg-surface-2/40 p-3 sm:grid-cols-2"><Info label={t("agile.cardEpic")} value={detailItem.epic_title || t("agile.noEpic")} /><Info label={t("agile.assignedRole")} value={detailItem.assigned_role ? t(`agile.roles.${detailItem.assigned_role}`) : t("agile.noAssignedRole")} /><Info label={t("agile.cardAssignee")} value={detailItem.assignee_name || detailItem.assignee_email || t("agile.unassigned")} /><Info label={t("agile.cardSprint")} value={detailItem.sprint_name || t("agile.backlog")} /><Info label={t("agile.dueDate")} value={dateLabel(detailItem.due_date)} /></div>{editPermission && <div className="flex flex-wrap gap-2"><button className={BUTTON} onClick={() => openEditItem(detailItem)}><Settings2 className="h-4 w-4" />{t("agile.editCard")}</button><button className={GHOST} onClick={() => void archiveItem(detailItem)}>{t("agile.archiveCard")}</button></div>}<section className="border-t border-line pt-4"><h3 className="flex items-center gap-2 font-semibold text-fg"><MessageSquare className="h-4 w-4 text-accent" />{t("agile.comments")}</h3><div className="mt-3 space-y-3">{commentsQuery.isLoading && <p className="text-xs text-fg-subtle">{t("agile.loadingComments")}</p>}{commentsQuery.data?.map((comment) => <CommentBubble key={comment.id} comment={comment} />)}{commentsQuery.data?.length === 0 && <p className="text-sm text-fg-subtle">{t("agile.noComments")}</p>}</div>{project.my_role !== "OBSERVER" && <form onSubmit={postComment} className="mt-3 flex items-end gap-2"><textarea className={`${FIELD} min-h-[70px] resize-y`} value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} maxLength={5000} placeholder={t("agile.writeComment")} required /><button className={`${BUTTON} h-10 shrink-0 px-3`} disabled={busy || !commentDraft.trim()} aria-label={t("agile.sendComment")}><Send className="h-4 w-4" /></button></form>}</section></div><aside className="space-y-4"><section className="rounded-xl border border-line/80 bg-surface-2/30 p-4"><h3 className="flex items-center gap-2 font-semibold text-fg"><History className="h-4 w-4 text-accent" />{t("agile.activityHistory")}</h3><div className="mt-3 space-y-3">{historyQuery.isLoading && <p className="text-xs text-fg-subtle">{t("agile.loadingHistory")}</p>}{historyQuery.data?.map((entry) => <HistoryRow key={entry.id} entry={entry} t={t} />)}{historyQuery.data?.length === 0 && <p className="text-sm text-fg-subtle">{t("agile.noHistory")}</p>}</div></section><p className="flex gap-2 text-xs leading-5 text-fg-subtle"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t("agile.historyAuditHint")}</p></aside></div></Modal>}
    </div>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="block text-xs font-semibold text-fg-muted">{label}</span>{children}{hint && <span className="block text-[11px] leading-4 text-fg-subtle">{hint}</span>}</label>;
}
function Alert({ kind, text, onClose, actionLabel }: { kind: "error" | "success"; text: string; onClose?: () => void; actionLabel?: string }) {
  return <div role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-xl border px-4 py-3 text-sm", kind === "error" ? "border-rose-400/30 bg-rose-400/5 text-rose-700 dark:text-rose-200" : "border-emerald-400/25 bg-emerald-400/5 text-emerald-700 dark:text-emerald-200")}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p className="min-w-0 flex-1">{text}</p>{actionLabel && <button className="font-semibold underline" onClick={onClose}>{actionLabel}</button>}{!actionLabel && onClose && <button aria-label="Cerrar" onClick={onClose}><X className="h-4 w-4" /></button>}</div>;
}
function Loading({ text }: { text: string }) { return <div className={`${PANEL} flex items-center gap-3 p-5 text-sm text-fg-muted`}><LoaderCircle className="h-4 w-4 animate-spin text-accent" />{text}</div>; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: React.ReactNode; detail: string }) { return <section className={`${PANEL} min-w-0 p-4`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-fg-muted">{label}</span><span className="rounded-xl border border-accent/20 bg-accent/5 p-2 text-accent"><Icon className="h-4 w-4" /></span></div><p className="mt-3 truncate text-xl font-bold text-fg">{value}</p><p className="mt-1 truncate text-xs text-fg-subtle">{detail}</p></section>; }
function EmptyInline({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) { return <div className="flex flex-col items-center py-6 text-center"><p className="max-w-sm text-sm text-fg-muted">{text}</p>{action && onAction && <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline" onClick={onAction}><Plus className="h-4 w-4" />{action}</button>}</div>; }
function ViewIntro({ title, desc, action, onAction }: { title: string; desc: string; action?: string; onAction?: () => void }) { return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-fg">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-5 text-fg-muted">{desc}</p></div>{action && onAction && <button className={BUTTON} onClick={onAction}><Plus className="h-4 w-4" />{action}</button>}</div>; }
function Filters({ query, setQuery, typeFilter, setTypeFilter, epicFilter, setEpicFilter, epics, t, compact = false }: { query: string; setQuery: (s: string) => void; typeFilter: ItemType | "ALL"; setTypeFilter: (s: ItemType | "ALL") => void; epicFilter: string; setEpicFilter: (s: string) => void; epics: AgileItem[]; t: (key: string) => string; compact?: boolean }) {
  return <div className={cn("mt-4 grid gap-2", compact ? "flex-1 sm:grid-cols-[minmax(130px,1fr)_140px_180px]" : "sm:grid-cols-[minmax(200px,1fr)_180px_220px]")}><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" /><input className={`${FIELD} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("agile.searchItems")} /></label><select className={FIELD} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ItemType | "ALL")}><option value="ALL">{t("agile.allTypes")}</option>{TYPES.map((type) => <option key={type} value={type}>{t(`agile.types.${type}`)}</option>)}</select><select className={FIELD} value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)}><option value="ALL">{t("agile.allEpics")}</option><option value="NONE">{t("agile.noEpic")}</option>{epics.map((epic) => <option key={epic.id} value={String(epic.id)}>{epic.key} · {epic.title}</option>)}</select></div>;
}
function BoardCard({ item, canEdit, onDragStart, onOpen, onEdit, onStatus, t }: { item: AgileItem; canEdit: boolean; onDragStart: () => void; onOpen: () => void; onEdit: () => void; onStatus: (status: ItemStatus) => void; t: (key: string) => string }) {
  return <article draggable={canEdit} onDragStart={onDragStart} onClick={onOpen} className="group cursor-pointer rounded-xl border border-line/80 bg-surface p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_10px_25px_rgb(20_90_220_/_0.10)] active:cursor-grabbing"><div className="flex items-start justify-between gap-2"><span className="font-mono text-[10px] font-bold tracking-wide text-accent">{item.key}</span>{canEdit && <button className="rounded-md p-1 text-fg-subtle opacity-100 transition hover:bg-surface-2 hover:text-accent sm:opacity-0 sm:group-hover:opacity-100" aria-label={t("agile.editCard")} onClick={(e) => { e.stopPropagation(); onEdit(); }}><Settings2 className="h-3.5 w-3.5" /></button>}</div><h4 className="mt-1.5 break-words text-sm font-semibold leading-5 text-fg">{item.title}</h4>{item.description && <p className="mt-1 line-clamp-2 text-xs leading-4 text-fg-muted">{item.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-1.5"><span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", PRIORITY_TONE[item.priority])}>{t(`agile.priorities.${item.priority}`)}</span>{item.assigned_role && <span className="rounded-md border border-accent/20 bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent">{t(`agile.roles.${item.assigned_role}`)}</span>}{item.epic_title && <span className="max-w-full truncate rounded-md border border-violet-400/20 bg-violet-400/5 px-1.5 py-0.5 text-[10px] text-violet-700 dark:text-violet-300">{item.epic_title}</span>}{item.estimate_points !== null && <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-fg-muted">{item.estimate_points} pts</span>}</div><div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5"><span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-fg-subtle"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-violet-500/20 text-[8px] font-bold text-accent">{initials(item.assignee_name || item.assignee_email || "-")}</span><span className="truncate">{item.assignee_name || t("agile.unassigned")}</span></span><span className="flex shrink-0 items-center gap-2 text-fg-subtle"><MessageSquare className="h-3 w-3" />{item.due_date && <span className="text-[10px]">{dateLabel(item.due_date)}</span>}</span></div><div className="mt-2 sm:hidden"><select aria-label={t("agile.cardStatus")} className="w-full rounded-lg border border-line bg-app px-2 py-1.5 text-xs text-fg" value={item.status} disabled={!canEdit} onClick={(e) => e.stopPropagation()} onChange={(e) => onStatus(e.target.value as ItemStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{t(`agile.statuses.${status}`)}</option>)}</select></div></article>;
}
function CompactItem({ item, onClick, t }: { item: AgileItem; onClick: () => void; t: (key: string) => string }) { return <button className="flex w-full items-center gap-3 rounded-xl border border-line/70 bg-surface-2/30 p-3 text-left transition hover:border-accent/30 hover:bg-surface-2" onClick={onClick}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/15 bg-accent/5 text-accent"><ListTodo className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-mono text-[10px] font-bold text-accent">{item.key}</span><span className="mt-0.5 block truncate text-sm font-medium text-fg">{item.title}</span></span><span className={cn("rounded-full border px-2 py-1 text-[10px]", STATUS_TONE[item.status])}>{t(`agile.statuses.${item.status}`)}</span></button>; }
function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className={cn("max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6", wide ? "max-w-5xl" : "max-w-2xl")}><div className="mb-5 flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-lg font-bold text-fg">{title}</h2>{subtitle && <p className="mt-1 text-xs text-fg-subtle">{subtitle}</p>}</div><button className="rounded-lg border border-line p-2 text-fg-subtle transition hover:bg-surface-2 hover:text-fg" aria-label="Cerrar" onClick={onClose}><X className="h-4 w-4" /></button></div>{children}</div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{label}</p><p className="mt-1 text-sm text-fg">{value}</p></div>; }
function CommentBubble({ comment }: { comment: AgileComment }) { return <article className="rounded-xl border border-line/70 bg-surface-2/30 p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-fg">{comment.author_name || comment.author_email}</p><time className="shrink-0 text-[10px] text-fg-subtle">{dateLabel(comment.created_at.slice(0, 10))}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-fg-muted">{comment.content}</p></article>; }
function HistoryRow({ entry, t }: { entry: AgileHistory; t: (key: string) => string }) {
  const fieldKey = `agile.historyFields.${entry.field_name}`;
  const translatedField = t(fieldKey);
  const fieldLabel = translatedField === fieldKey ? entry.field_name : translatedField;
  return <div className="relative border-l border-line pl-3 pb-2 last:pb-0"><span className="absolute -left-[4px] top-1 h-1.5 w-1.5 rounded-full bg-accent" /><p className="text-xs font-semibold text-fg">{entry.actor_name || t("agile.teamMember")}</p><p className="mt-1 break-words text-xs leading-5 text-fg-muted">{fieldLabel}{entry.new_value !== null ? `: ${entry.new_value}` : ""}</p><time className="text-[10px] text-fg-subtle">{new Date(entry.created_at).toLocaleString()}</time></div>;
}
