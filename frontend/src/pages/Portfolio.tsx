import { Download, ExternalLink, FileText } from "lucide-react";
import { useProjects, type Project, type ProjectMedia } from "@/api/projects";
import { cn } from "@/lib/utils";

function MediaItem({ media, title, wide }: { media: ProjectMedia; title: string; wide: boolean }) {
  const span = wide ? "sm:col-span-2" : "";
  const caption = media.caption && (
    <figcaption className="mt-2 text-sm text-fg-subtle">{media.caption}</figcaption>
  );

  if (media.media_type === "video") {
    return (
      <figure className={span}>
        <video controls preload="metadata" className="w-full rounded-lg bg-black" aria-label={media.caption || `Video de ${title}`}>
          <source src={media.url} />
          Tu navegador no puede reproducir este video. <a href={media.url}>Abrirlo en otra pestaña</a>.
        </video>
        {caption}
      </figure>
    );
  }
  if (media.media_type === "file") {
    return (
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("flex items-center gap-3 rounded-lg border bg-surface p-4 hover:border-brand", span)}
      >
        <FileText className="h-8 w-8 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">{media.caption || "Archivo del proyecto"}</span>
          <span className="block truncate text-sm text-fg-subtle">{media.url}</span>
        </span>
        <Download className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
        <span className="sr-only">(se abre en otra pestaña)</span>
      </a>
    );
  }
  return (
    <figure className={span}>
      <img src={media.url} alt={media.caption || title} loading="lazy" className="w-full rounded-lg border bg-surface-2" />
      {caption}
    </figure>
  );
}

function ProjectSection({ project }: { project: Project }) {
  const gallery = project.media;
  const done = project.status === "terminado";
  return (
    <article aria-labelledby={`project-${project.id}`}>
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              done ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
            )}
          >
            {done ? "Terminado" : "En progreso"}
          </span>
          {project.client_name && <span className="text-fg-subtle">Cliente: {project.client_name}</span>}
        </div>
        <h2 id={`project-${project.id}`} className="mt-3 text-2xl font-bold text-fg sm:text-3xl">
          {project.title}
        </h2>
      </header>

      {gallery.length > 0 && (
        <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
          {gallery.map((m, i) => (
            <MediaItem key={m.id ?? i} media={m} title={project.title} wide={i === 0 && gallery.length > 1 || gallery.length === 1} />
          ))}
        </div>
      )}

      <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed text-fg-muted">{project.description}</p>

      {project.project_url && (
        <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
          Ver el proyecto <ExternalLink className="h-4 w-4" aria-hidden />
          <span className="sr-only">(se abre en otra pestaña)</span>
        </a>
      )}
    </article>
  );
}

export default function Portfolio() {
  const { data: projects, isLoading, isError, refetch } = useProjects();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-fg">Portfolio</h1>
      <p className="mt-2 text-fg-muted">Trabajos hechos y proyectos en progreso.</p>

      {isLoading && <p className="mt-8 text-fg-subtle">Cargando...</p>}
      {isError && (
        <p role="alert" className="mt-8 text-red-600 dark:text-red-400">
          No pudimos cargar el portfolio. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      )}
      {projects && projects.length === 0 && <p className="mt-8 text-fg-subtle">Pronto vamos a mostrar acá nuestros proyectos.</p>}

      {/* space-y-24 = 6rem ≈ 4 renglones de texto entre un proyecto y el siguiente. */}
      <div className="mt-16 space-y-24">
        {projects?.map((project) => <ProjectSection key={project.id} project={project} />)}
      </div>
    </div>
  );
}
