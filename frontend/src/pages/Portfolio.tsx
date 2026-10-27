import { Trans, useTranslation } from "react-i18next";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useProjects, type Project, type ProjectMedia } from "@/api/projects";
import { cn } from "@/lib/utils";

function MediaItem({ media, title, wide }: { media: ProjectMedia; title: string; wide: boolean }) {
  const { t } = useTranslation();
  const span = wide ? "ajr-portfolio-media-wide" : "";
  const caption = media.caption && (
    <figcaption className="ajr-portfolio-caption">{media.caption}</figcaption>
  );

  if (media.media_type === "video") {
    return (
      <figure className={cn("ajr-portfolio-media-item", span)}>
        <video controls preload="metadata" className="ajr-portfolio-media ajr-portfolio-video" aria-label={media.caption || t("pubPortfolio.videoLabel", { title })}>
          <source src={media.url} />
          <Trans i18nKey="pubPortfolio.videoFallback" components={{ 1: <a href={media.url} /> }} />
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
        className={cn("ajr-portfolio-file ajr-portfolio-media-item", span)}
      >
        <FileText className="h-8 w-8 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-fg">{media.caption || t("pubPortfolio.fileFallback")}</span>
          <span className="mt-1 block truncate text-sm text-fg-subtle">{media.url}</span>
        </span>
        <Download className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden />
        <span className="sr-only">{t("pubPortfolio.newTab")}</span>
      </a>
    );
  }
  return (
    <figure className={cn("ajr-portfolio-media-item", span)}>
      <img src={media.url} alt={media.caption || title} loading="lazy" className="ajr-portfolio-media" />
      {caption}
    </figure>
  );
}

function ProjectSection({ project, featured }: { project: Project; featured: boolean }) {
  const { t } = useTranslation();
  const gallery = project.media;
  const done = project.status === "terminado";
  return (
    <article
      id={`portfolio-project-${project.id}`}
      aria-labelledby={`project-${project.id}`}
      className={cn("ajr-portfolio-project", featured && "ajr-portfolio-project--featured")}
    >
      {featured && (
        <div className="ajr-portfolio-featured-label">
          <span className="ajr-status-pulse" aria-hidden="true" />
          {t("pubPortfolio.featured")}
        </div>
      )}
      <header className="ajr-portfolio-project-header">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className={cn("ajr-portfolio-status", done ? "ajr-portfolio-status--done" : "ajr-portfolio-status--progress")}>
            <span aria-hidden="true" />
            {done ? t("pubPortfolio.done") : t("pubPortfolio.inProgress")}
          </span>
          {project.client_name && <span className="ajr-portfolio-client">{t("pubPortfolio.client", { name: project.client_name })}</span>}
        </div>
        <h2 id={`project-${project.id}`} className="ajr-portfolio-project-title">
          {project.title}
        </h2>
      </header>

      <div className="ajr-portfolio-project-copy">
        <p className="ajr-portfolio-description">{project.description}</p>
        {project.project_url && (
          <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="ajr-portfolio-link">
            {t("pubPortfolio.viewProject")} <ExternalLink className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("pubPortfolio.newTab")}</span>
          </a>
        )}
      </div>

      {gallery.length > 0 && (
        <div className="ajr-portfolio-gallery" role="group" aria-label={t("pubPortfolio.mediaFor", { title: project.title })}>
          {gallery.map((media, index) => (
            <MediaItem
              key={media.id ?? index}
              media={media}
              title={project.title}
              wide={gallery.length === 1 || (index === 0 && gallery.length > 1)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export default function Portfolio() {
  const { t } = useTranslation();
  const { data: projects, isLoading, isError, refetch } = useProjects();

  return (
    <div className="ajr-portfolio-page mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <header className="ajr-portfolio-hero">
        <p className="ajr-section-eyebrow">{t("pubPortfolio.eyebrow")}</p>
        <h1 className="ajr-section-title">{t("pubPortfolio.title")}</h1>
        <p className="ajr-section-copy">{t("pubPortfolio.subtitle")}</p>
        <span className="ajr-portfolio-hero-rule" aria-hidden="true" />
      </header>

      {isLoading && <p className="ajr-portfolio-state" role="status">{t("pubPortfolio.loading")}</p>}
      {isError && (
        <p role="alert" className="ajr-portfolio-state ajr-portfolio-state--error">
          {t("pubPortfolio.loadError")} <button onClick={() => refetch()} className="font-semibold underline underline-offset-4">{t("pubPortfolio.retry")}</button>
        </p>
      )}
      {projects && projects.length === 0 && <p className="ajr-portfolio-state">{t("pubPortfolio.empty")}</p>}

      {projects && projects.length > 0 && (
        <section className="ajr-portfolio-grid" aria-label={t("pubPortfolio.projectsLabel")}>
          {projects.map((project, index) => (
            <ProjectSection key={project.id} project={project} featured={index === 0} />
          ))}
        </section>
      )}
    </div>
  );
}
