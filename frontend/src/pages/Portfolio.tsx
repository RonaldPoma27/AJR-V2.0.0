import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRightCircle,
  ArrowUpRight,
  Clock3,
  FileText,
  Layers3,
  Play,
  Sparkles,
} from "lucide-react";
import { useProjects, type PortfolioBlock, type PortfolioTextMark, type Project } from "@/api/projects";
import { cn } from "@/lib/utils";

const BLOCK_SPANS: Record<PortfolioBlock["size"], string> = {
  small: "ajr-bento-span-small",
  medium: "ajr-bento-span-medium",
  large: "ajr-bento-span-large",
  wide: "ajr-bento-span-wide",
  tall: "ajr-bento-span-tall",
  full: "ajr-bento-span-full",
};

function projectStyle(project: Project): CSSProperties {
  return {
    "--portfolio-card-bg": project.style.background_color,
    "--portfolio-card-border": project.style.border_color,
    "--portfolio-accent": project.style.accent_color,
    "--portfolio-text": project.style.text_color,
  } as CSSProperties;
}

function renderText(text: string, marks: PortfolioTextMark[], baseColor: string) {
  if (!marks.length) return <span>{text}</span>;
  const boundaries = Array.from(new Set([0, text.length, ...marks.flatMap((mark) => [mark.start, mark.end])]))
    .filter((point) => point >= 0 && point <= text.length)
    .sort((a, b) => a - b);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    if (end <= start) return null;
    const active = marks.filter((mark) => mark.start <= start && mark.end >= end);
    const colorMark = [...active].reverse().find((mark) => mark.color || (mark.gradient_start && mark.gradient_end));
    const style: CSSProperties = {
      color: colorMark?.color ?? baseColor,
      fontWeight: active.some((mark) => mark.bold) ? 750 : undefined,
      fontStyle: active.some((mark) => mark.italic) ? "italic" : undefined,
      textDecoration: active.some((mark) => mark.underline) ? "underline" : undefined,
      textDecorationColor: colorMark?.color ?? colorMark?.gradient_start ?? "currentColor",
      textUnderlineOffset: "0.18em",
    };
    if (colorMark?.gradient_start && colorMark.gradient_end) {
      style.backgroundImage = `linear-gradient(100deg, ${colorMark.gradient_start}, ${colorMark.gradient_end})`;
      style.backgroundClip = "text";
      style.WebkitBackgroundClip = "text";
      style.WebkitTextFillColor = "transparent";
    }
    return <span key={`${start}-${end}`} style={style}>{text.slice(start, end)}</span>;
  });
}

function legacyBlocks(project: Project): PortfolioBlock[] {
  const text: PortfolioBlock[] = project.description
    ? [{
        id: `legacy-copy-${project.id}`,
        type: "text",
        size: "wide",
        text: project.description,
        background_color: "#1B1B1B",
        border_color: "#383838",
        text_color: project.style.text_color,
        fit: "contain",
        marks: [],
      }]
    : [];
  const media = project.media.map((item, index): PortfolioBlock => ({
    id: `legacy-media-${item.id ?? index}`,
    type: item.media_type,
    size: project.media.length === 1 || index === 0 ? "wide" : "medium",
    text: "",
    url: item.url,
    caption: item.caption,
    background_color: "#111111",
    border_color: "#383838",
    text_color: project.style.text_color,
    fit: "contain",
    marks: [],
  }));
  return [...text, ...media];
}

function BentoBlock({ block, project }: { block: PortfolioBlock; project: Project }) {
  const style: CSSProperties = {
    backgroundColor: block.background_color,
    borderColor: block.border_color,
    color: block.text_color || project.style.text_color,
    "--portfolio-accent": project.style.accent_color,
  } as CSSProperties;
  const sizeClass = BLOCK_SPANS[block.size] ?? BLOCK_SPANS.medium;

  return (
    <article className={cn("ajr-bento-block", sizeClass, `ajr-bento-block--${block.type}`)} style={style}>
      {block.type === "text" && (
        <p className="ajr-bento-text">{renderText(block.text, block.marks ?? [], block.text_color || project.style.text_color)}</p>
      )}
      {block.type === "image" && block.url && (
        <figure className="ajr-bento-figure">
          <img src={block.url} alt={block.caption || project.title} loading="lazy" className="ajr-bento-image" style={{ objectFit: block.fit }} />
          {block.caption && <figcaption className="ajr-bento-caption">{block.caption}</figcaption>}
        </figure>
      )}
      {block.type === "video" && block.url && (
        <figure className="ajr-bento-figure">
          <video controls preload="metadata" className="ajr-bento-video" aria-label={block.caption || `Video de ${project.title}`}>
            <source src={block.url} />
          </video>
          {block.caption && <figcaption className="ajr-bento-caption">{block.caption}</figcaption>}
        </figure>
      )}
      {block.type === "file" && block.url && (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="ajr-bento-file">
          <FileText aria-hidden className="h-7 w-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <strong className="block truncate">{block.caption || "Archivo del proyecto"}</strong>
            <span className="mt-1 block text-xs opacity-55">Abrir recurso</span>
          </span>
          <ArrowUpRight aria-hidden className="h-5 w-5 shrink-0" />
        </a>
      )}
    </article>
  );
}

function ProjectOrbitCard({ project, position, onClick }: { project: Project; position: "left" | "center" | "right"; onClick: () => void }) {
  const image = project.logo_url || project.image_url;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("ajr-orbit-card", `ajr-orbit-card--${position}`)}
      style={projectStyle(project)}
      aria-label={`${project.title}: ${position === "center" ? "ver proyecto" : "seleccionar proyecto"}`}
      tabIndex={0}
    >
      <span className="ajr-orbit-card-art">
        {image ? <img src={image} alt="" loading="lazy" /> : <Layers3 aria-hidden className="h-12 w-12 opacity-35" />}
        <span className="ajr-orbit-card-shade" />
      </span>
      <span className="ajr-orbit-card-info">
        <span className="ajr-orbit-card-index">{String(project.position + 1).padStart(2, "0")}</span>
        <strong>{project.title}</strong>
        {position === "center" && <span className="ajr-orbit-card-summary">{project.description}</span>}
      </span>
      {position === "center" && <span className="ajr-orbit-card-open"><ArrowUpRight aria-hidden className="h-5 w-5" /></span>}
    </button>
  );
}

export default function Portfolio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: projects, isLoading, isError, refetch } = useProjects();
  const [activeIndex, setActiveIndex] = useState(0);
  const dragStart = useRef<number | null>(null);
  const didDrag = useRef(false);
  const selectedProject = useMemo(
    () => projects?.find((project) => String(project.id) === projectId),
    [projects, projectId],
  );

  useEffect(() => {
    if (!projects?.length) return;
    if (projectId) {
      const index = projects.findIndex((project) => String(project.id) === projectId);
      if (index >= 0) setActiveIndex(index);
    } else {
      setActiveIndex((current) => Math.min(current, projects.length - 1));
    }
  }, [projects, projectId]);

  const changeActive = (delta: -1 | 1) => {
    if (!projects?.length) return;
    setActiveIndex((current) => (current + delta + projects.length) % projects.length);
  };
  const goToProject = (project: Project) => navigate(`/portfolio/${project.id}`);
  const active = projects?.[activeIndex];
  const previous = projects?.length ? projects[(activeIndex - 1 + projects.length) % projects.length] : undefined;
  const next = projects?.length ? projects[(activeIndex + 1) % projects.length] : undefined;

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    dragStart.current = event.clientX;
    didDrag.current = false;
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStart.current === null) return;
    const distance = event.clientX - dragStart.current;
    if (Math.abs(distance) > 56) {
      didDrag.current = true;
      changeActive(distance > 0 ? -1 : 1);
    }
    dragStart.current = null;
  };

  if (projectId) {
    if (isLoading) return <div className="ajr-portfolio-state">{t("pubPortfolio.loading")}</div>;
    if (!selectedProject) {
      return (
        <main className="ajr-portfolio-page ajr-portfolio-route mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <p className="ajr-portfolio-state">{t("pubPortfolio.projectNotFound")}</p>
          <button type="button" className="ajr-portfolio-back" onClick={() => navigate("/portfolio")}><ArrowLeft className="h-4 w-4" /> {t("pubPortfolio.back")}</button>
        </main>
      );
    }
    const blocks = selectedProject.blocks?.length ? selectedProject.blocks : legacyBlocks(selectedProject);
    const done = selectedProject.status === "terminado";
    return (
      <main className="ajr-portfolio-page ajr-portfolio-route mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-12 lg:px-8" style={projectStyle(selectedProject)}>
        <button type="button" className="ajr-portfolio-back" onClick={() => navigate("/portfolio")}>
          <ArrowLeft aria-hidden className="h-4 w-4" /> {t("pubPortfolio.backToPortfolio")}
        </button>
        <header className="ajr-project-detail-hero" style={projectStyle(selectedProject)}>
          <div className="ajr-project-detail-logo">
            {selectedProject.logo_url ? <img src={selectedProject.logo_url} alt={`Logo ${selectedProject.title}`} /> : <Layers3 aria-hidden className="h-10 w-10 opacity-40" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("ajr-portfolio-status", done ? "ajr-portfolio-status--done" : "ajr-portfolio-status--progress")}>
                <span aria-hidden="true" />{done ? t("pubPortfolio.done") : t("pubPortfolio.inProgress")}
              </span>
              {selectedProject.client_name && <span className="ajr-portfolio-client">{selectedProject.client_name}</span>}
              <span className="ajr-project-detail-number">{String(selectedProject.position + 1).padStart(2, "0")}</span>
            </div>
            <h1 className="ajr-project-detail-title">{selectedProject.title}</h1>
            <p className="ajr-project-detail-summary">{selectedProject.description}</p>
          </div>
          {selectedProject.project_url && (
            <a href={selectedProject.project_url} target="_blank" rel="noopener noreferrer" className="ajr-project-live-link">
              {t("pubPortfolio.viewProject")} <ArrowUpRight aria-hidden className="h-4 w-4" />
            </a>
          )}
        </header>
        <section className="ajr-project-bento-grid" aria-label={t("pubPortfolio.projectContent", { title: selectedProject.title })}>
          {blocks.map((block) => <BentoBlock key={block.id} block={block} project={selectedProject} />)}
        </section>
        <nav className="ajr-project-detail-nav" aria-label={t("pubPortfolio.projectNavigation")}>
          {previous && <button type="button" onClick={() => goToProject(previous)}><ArrowLeft aria-hidden className="h-4 w-4" /><span><small>{t("pubPortfolio.previous")}</small>{previous.title}</span></button>}
          <button type="button" className="ajr-project-detail-all" onClick={() => navigate("/portfolio")}>{t("pubPortfolio.allProjects")}</button>
          {next && <button type="button" onClick={() => goToProject(next)} className="text-right"><span><small>{t("pubPortfolio.next")}</small>{next.title}</span><ArrowRightCircle aria-hidden className="h-4 w-4" /></button>}
        </nav>
      </main>
    );
  }

  return (
    <main className="ajr-portfolio-page ajr-portfolio-route mx-auto max-w-7xl px-5 py-9 sm:px-6 sm:py-12 lg:px-8">
      <header className="ajr-portfolio-hero ajr-portfolio-hero--haniel">
        <p className="ajr-section-eyebrow">{t("pubPortfolio.eyebrow")}</p>
        <h1 className="ajr-section-title">{t("pubPortfolio.title")}</h1>
        <p className="ajr-section-copy">{t("pubPortfolio.subtitleHaniel")}</p>
      </header>

      {isLoading && <p className="ajr-portfolio-state" role="status">{t("pubPortfolio.loading")}</p>}
      {isError && (
        <p role="alert" className="ajr-portfolio-state ajr-portfolio-state--error">
          {t("pubPortfolio.loadError")} <button onClick={() => refetch()} className="font-semibold underline underline-offset-4">{t("pubPortfolio.retry")}</button>
        </p>
      )}
      {!isLoading && !isError && projects && (
        <>
          {projects.length > 0 ? (
            <section className="ajr-project-orbit" aria-label={t("pubPortfolio.projectsLabel")} style={active ? projectStyle(active) : undefined}>
              <div
                className="ajr-project-orbit-stage"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { dragStart.current = null; didDrag.current = false; }}
              >
                {previous && previous.id !== active?.id && <ProjectOrbitCard project={previous} position="left" onClick={() => { const dragged = didDrag.current; didDrag.current = false; if (!dragged) changeActive(-1); }} />}
                {active && <ProjectOrbitCard project={active} position="center" onClick={() => { const dragged = didDrag.current; didDrag.current = false; if (!dragged) goToProject(active); }} />}
                {next && next.id !== active?.id && <ProjectOrbitCard project={next} position="right" onClick={() => { const dragged = didDrag.current; didDrag.current = false; if (!dragged) changeActive(1); }} />}
                {projects.length === 1 && <div className="ajr-orbit-side-placeholder ajr-orbit-side-placeholder--left" aria-hidden="true" />}
                {projects.length === 1 && <div className="ajr-orbit-side-placeholder ajr-orbit-side-placeholder--right" aria-hidden="true" />}
              </div>
              <div className="ajr-project-orbit-controls">
                <button type="button" onClick={() => changeActive(-1)} disabled={projects.length < 2} aria-label={t("pubPortfolio.previousProject")}><ArrowLeftCircle aria-hidden /></button>
                <div className="ajr-project-orbit-count"><strong>{String(activeIndex + 1).padStart(2, "0")}</strong><span>/</span>{String(projects.length).padStart(2, "0")}</div>
                <button type="button" onClick={() => changeActive(1)} disabled={projects.length < 2} aria-label={t("pubPortfolio.nextProject")}><ArrowRightCircle aria-hidden /></button>
              </div>
            </section>
          ) : (
            <p className="ajr-portfolio-state">{t("pubPortfolio.empty")}</p>
          )}
          <section className="ajr-coming-soon" aria-label={t("pubPortfolio.comingSoon")}>
            <div className="ajr-coming-soon-icon"><Clock3 aria-hidden className="h-7 w-7" /><Sparkles aria-hidden className="ajr-coming-soon-spark" /></div>
            <div><p className="ajr-coming-soon-kicker">{t("pubPortfolio.inTheWorkshop")}</p><h2>{t("pubPortfolio.comingSoon")}</h2></div>
            <span className="ajr-coming-soon-mark"><Play aria-hidden className="h-4 w-4" /></span>
          </section>
        </>
      )}
    </main>
  );
}
