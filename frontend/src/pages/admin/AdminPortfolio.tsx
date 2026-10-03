import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { useMe } from "@/api/auth";
import {
  MAX_GALLERY_ITEMS,
  useDeleteProject,
  useProjects,
  useSaveProject,
  type MediaType,
  type Project,
  type ProjectInput,
  type ProjectMedia,
  type ProjectStatus,
} from "@/api/projects";
import { SelectField, TextAreaField, TextField } from "@/components/forms/Fields";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { getServerDetail } from "@/lib/errors";
import { cn } from "@/lib/utils";

const MEDIA_LABEL: Record<MediaType, string> = { image: "Imagen", video: "Video", file: "Archivo" };
const STATUS_LABEL: Record<ProjectStatus, string> = { terminado: "Terminado", en_progreso: "En progreso" };

const emptyInput: ProjectInput = {
  title: "",
  description: "",
  status: "en_progreso",
  client_name: null,
  project_url: null,
  media: [],
};

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/** Mini vista previa del archivo (solo si es una imagen con URL válida). */
function MediaThumb({ media }: { media: ProjectMedia }) {
  const [broken, setBroken] = useState(false);
  const box = "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 text-fg-subtle";
  if (media.media_type === "image" && isHttpUrl(media.url) && !broken) {
    return (
      <span className={box}>
        <img src={media.url} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      </span>
    );
  }
  return <span className={box}>{media.media_type === "video" ? <Video className="h-6 w-6" aria-hidden /> : <FileText className="h-6 w-6" aria-hidden />}</span>;
}

function Editor({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const save = useSaveProject();
  const [form, setForm] = useState<ProjectInput>(
    project
      ? { title: project.title, description: project.description, status: project.status, client_name: project.client_name, project_url: project.project_url, media: project.media.map((m) => ({ ...m })) }
      : emptyInput
  );
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setMedia = (index: number, patch: Partial<ProjectMedia>) =>
    set("media", form.media.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const moveMedia = (index: number, delta: -1 | 1) => {
    const next = [...form.media];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("media", next);
  };

  const badUrls = form.media.map((m) => !isHttpUrl(m.url));
  const errors = {
    title: !form.title.trim() ? "Poné un título." : undefined,
    description: !form.description.trim() ? "Escribí la descripción del proyecto." : undefined,
    project_url: form.project_url && !isHttpUrl(form.project_url) ? "Tiene que empezar con http:// o https://" : undefined,
  };
  const hasErrors = Boolean(errors.title || errors.description || errors.project_url) || badUrls.some(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (hasErrors || save.isPending) return;
    save.mutate(
      {
        id: project?.id,
        input: {
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          client_name: form.client_name?.trim() || null,
          project_url: form.project_url?.trim() || null,
          media: form.media.map((m) => ({ ...m, url: m.url.trim(), caption: m.caption?.trim() || null })),
        },
      },
      { onSuccess: onClose }
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-lg border bg-surface p-5">
      <h2 className="text-lg font-semibold text-fg">{project ? "Editar proyecto" : "Nuevo proyecto"}</h2>

      <TextField label="Título" name="title" value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} error={showErrors ? errors.title : undefined} />
      <TextAreaField label="Descripción" name="description" value={form.description} onChange={(e) => set("description", e.target.value)} required maxLength={10000} rows={6} error={showErrors ? errors.description : undefined} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Estado" name="status" value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)} options={Object.keys(STATUS_LABEL)} placeholder="Estado" />
        <TextField label="Cliente (opcional)" name="client_name" value={form.client_name ?? ""} onChange={(e) => set("client_name", e.target.value)} maxLength={200} />
        <TextField label="Link del proyecto (opcional)" name="project_url" value={form.project_url ?? ""} onChange={(e) => set("project_url", e.target.value)} placeholder="https://" error={showErrors ? errors.project_url : undefined} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-fg-muted">Galería ({form.media.length}/{MAX_GALLERY_ITEMS})</legend>
        <p className="mt-1 text-xs text-fg-subtle">Imágenes, videos o archivos, en el orden en que se muestran. Por ahora se cargan por link (la subida directa llegará con Cloudinary).</p>

        <ul className="mt-3 space-y-3">
          {form.media.map((m, i) => (
            <li key={i} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
              <MediaThumb media={m} />
              <div className="grid min-w-[14rem] flex-1 gap-2 sm:grid-cols-[1fr_8rem]">
                <div>
                  <label className="sr-only" htmlFor={`media-url-${i}`}>Link del archivo {i + 1}</label>
                  <input id={`media-url-${i}`} value={m.url} onChange={(e) => setMedia(i, { url: e.target.value })} placeholder="https://…" aria-invalid={showErrors && badUrls[i]} className="w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                  {showErrors && badUrls[i] && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">Ingresá un link que empiece con http:// o https://</p>}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`media-type-${i}`}>Tipo del archivo {i + 1}</label>
                  <select id={`media-type-${i}`} value={m.media_type} onChange={(e) => setMedia(i, { media_type: e.target.value as MediaType })} className="w-full rounded-md border bg-surface px-2 py-2 text-sm text-fg">
                    {(Object.keys(MEDIA_LABEL) as MediaType[]).map((t) => <option key={t} value={t}>{MEDIA_LABEL[t]}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="sr-only" htmlFor={`media-caption-${i}`}>Texto del archivo {i + 1}</label>
                  <input id={`media-caption-${i}`} value={m.caption ?? ""} onChange={(e) => setMedia(i, { caption: e.target.value })} maxLength={300} placeholder="Texto debajo del archivo (opcional)" className="w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => moveMedia(i, -1)} disabled={i === 0} aria-label={`Subir archivo ${i + 1}`} className="rounded-md border p-2 text-fg-muted hover:bg-surface-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => moveMedia(i, 1)} disabled={i === form.media.length - 1} aria-label={`Bajar archivo ${i + 1}`} className="rounded-md border p-2 text-fg-muted hover:bg-surface-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => set("media", form.media.filter((_, idx) => idx !== i))} aria-label={`Quitar archivo ${i + 1}`} className="rounded-md border p-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" disabled={form.media.length >= MAX_GALLERY_ITEMS} onClick={() => set("media", [...form.media, { url: "", media_type: "image", caption: null }])} className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-fg-muted hover:border-brand hover:text-accent disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden /> Agregar archivo
        </button>
      </fieldset>

      {save.isError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getServerDetail(save.error) ?? "No pudimos guardar el proyecto. Revisá los datos y probá de nuevo."}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{save.isPending ? "Guardando..." : "Guardar proyecto"}</button>
        <button type="button" onClick={onClose} className="rounded-md border px-5 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-2">Cancelar</button>
      </div>
    </form>
  );
}

/** Editor del portfolio: TECHNICIAN (editor) y ADMIN crean/editan; solo ADMIN borra. */
export default function AdminPortfolio() {
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useProjects();
  const remove = useDeleteProject();
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Portfolio</h1>
          <p className="text-sm text-fg-subtle">Proyectos que se muestran en la página pública, con su galería.</p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            <Plus className="h-4 w-4" aria-hidden /> Nuevo proyecto
          </button>
        )}
      </div>

      {editing !== null && <Editor key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      {isLoading && <p className="text-fg-subtle">Cargando…</p>}
      {isError && <p role="alert" className="text-red-600 dark:text-red-400">No pudimos cargar el portfolio. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button></p>}
      {remove.isError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getServerDetail(remove.error) ?? "No pudimos borrar el proyecto."}</p>}
      {data && data.length === 0 && editing === null && <p className="rounded-lg border border-dashed p-10 text-center text-fg-subtle">Todavía no hay proyectos. Creá el primero.</p>}

      <ul className="space-y-3">
        {data?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-lg border bg-surface p-4">
            {p.media[0] ? <MediaThumb media={p.media[0]} /> : <span className="h-14 w-14 shrink-0 rounded-md bg-surface-2" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-fg">{p.title}</p>
              <p className="text-sm text-fg-subtle">
                <span className={cn("font-medium", p.status === "terminado" ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300")}>{STATUS_LABEL[p.status]}</span>
                {" · "}{p.media.length} {p.media.length === 1 ? "archivo" : "archivos"}{p.client_name ? ` · ${p.client_name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-fg-muted hover:border-brand hover:text-accent">
                <Pencil className="h-4 w-4" aria-hidden /> Editar
              </button>
              {isAdmin && <ConfirmButton label="Borrar" question="¿Borrar el proyecto y su galería?" confirmLabel="Sí, borrar" onConfirm={() => remove.mutate(p.id)} disabled={remove.isPending} icon={<Trash2 className="h-4 w-4" aria-hidden />} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
