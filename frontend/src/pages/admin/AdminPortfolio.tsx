import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  GripVertical,
  ImagePlus,
  Italic,
  Plus,
  Save,
  Trash2,
  Underline as UnderlineIcon,
  Video,
  X,
  FileText,
  Type,
  Layers3,
  Eye,
  EyeOff,
} from "lucide-react";
import { useMe } from "@/api/auth";
import {
  BLOCK_TEXT_LIMITS,
  MAX_GALLERY_ITEMS,
  MAX_PORTFOLIO_BLOCKS,
  useDeleteProject,
  useProjects,
  useReorderProjects,
  useSaveProject,
  type PortfolioBlock,
  type PortfolioBlockSize,
  type PortfolioStyle,
  type Project,
  type ProjectInput,
  type ProjectStatus,
} from "@/api/projects";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { getServerDetail } from "@/lib/errors";
import { cn } from "@/lib/utils";

const DEFAULT_STYLE: PortfolioStyle = {
  background_color: "#151515",
  border_color: "#383838",
  accent_color: "#22D3EE",
  text_color: "#F3F4F6",
};
const SIZE_KEYS: PortfolioBlockSize[] = ["small", "medium", "large", "wide", "tall", "full"];
const STATUS_KEYS: ProjectStatus[] = ["terminado", "en_progreso"];
const STATUS_LABEL_KEY: Record<ProjectStatus, string> = { terminado: "adminPortfolio.statusDone", en_progreso: "adminPortfolio.statusInProgress" };
const emptyInput: ProjectInput = {
  title: "",
  description: "",
  status: "en_progreso",
  client_name: null,
  project_url: null,
  logo_url: null,
  style: DEFAULT_STYLE,
  blocks: [],
  media: [],
};

function makeBlock(type: PortfolioBlock["type"]): PortfolioBlock {
  return {
    id: `block-${crypto.randomUUID()}`,
    type,
    size: type === "image" ? "medium" : type === "text" ? "large" : "wide",
    text: "",
    url: null,
    caption: null,
    background_color: "#1B1B1B",
    border_color: "#383838",
    text_color: "#F3F4F6",
    gradient_start: null,
    gradient_end: null,
    fit: "contain",
    marks: [],
  };
}

function legacyBlocks(project: Project): PortfolioBlock[] {
  const blocks: PortfolioBlock[] = [];
  if (project.description) {
    blocks.push({ ...makeBlock("text"), id: `legacy-text-${project.id}`, size: "wide", text: project.description });
  }
  for (const [index, media] of project.media.entries()) {
    blocks.push({
      ...makeBlock(media.media_type),
      id: `legacy-${media.id ?? index}`,
      size: project.media.length === 1 || index === 0 ? "wide" : "medium",
      url: media.url,
      caption: media.caption,
    });
  }
  return blocks;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="ajr-admin-color-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

function Editor({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveProject();
  const [form, setForm] = useState<ProjectInput>(() => project
    ? {
        title: project.title,
        description: project.description,
        status: project.status,
        client_name: project.client_name,
        project_url: project.project_url,
        logo_url: project.logo_url,
        style: { ...DEFAULT_STYLE, ...project.style },
        blocks: project.blocks?.length ? project.blocks.map((block) => ({ ...block, marks: block.marks ?? [] })) : legacyBlocks(project),
        media: project.media.map((item) => ({ ...item })),
      }
    : emptyInput);
  const [showErrors, setShowErrors] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ blockId: string; start: number; end: number } | null>(null);
  const [markColor, setMarkColor] = useState("#22D3EE");
  const [gradientStart, setGradientStart] = useState("#22D3EE");
  const [gradientEnd, setGradientEnd] = useState("#8B5CF6");
  const [showGlobalStyle, setShowGlobalStyle] = useState(true);
  const draggedBlockId = useRef<string | null>(null);

  const setField = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateBlock = (blockId: string, patch: Partial<PortfolioBlock>) => setForm((current) => ({
    ...current,
    blocks: current.blocks.map((block) => {
      if (block.id !== blockId) return block;
      const next = { ...block, ...patch };
      const limit = BLOCK_TEXT_LIMITS[next.size];
      if (next.type === "text" && next.text.length > limit) {
        next.text = next.text.slice(0, limit);
        next.marks = next.marks.flatMap((mark) => {
          const end = Math.min(mark.end, limit);
          return end > mark.start ? [{ ...mark, end }] : [];
        });
      }
      return next;
    }),
  }));
  const mediaBlockCount = form.blocks.filter((block) => block.type !== "text").length;
  const addBlock = (type: PortfolioBlock["type"]) => {
    if (form.blocks.length >= MAX_PORTFOLIO_BLOCKS) return;
    if (type !== "text" && mediaBlockCount >= MAX_GALLERY_ITEMS) return;
    setField("blocks", [...form.blocks, makeBlock(type)]);
  };
  const moveBlock = (blockId: string, delta: -1 | 1) => {
    const next = [...form.blocks];
    const index = next.findIndex((block) => block.id === blockId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setField("blocks", next);
  };
  const reorderBlock = (targetId: string) => {
    const sourceId = draggedBlockId.current;
    draggedBlockId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const next = [...form.blocks];
    const from = next.findIndex((block) => block.id === sourceId);
    const to = next.findIndex((block) => block.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setField("blocks", next);
  };

  const applyMark = (patch: Partial<NonNullable<PortfolioBlock["marks"]>[number]>) => {
    if (!selectedRange || selectedRange.end <= selectedRange.start) return;
    const block = form.blocks.find((item) => item.id === selectedRange.blockId);
    if (!block) return;
    const existing = block.marks.find((mark) => mark.start === selectedRange.start && mark.end === selectedRange.end) ?? {
      start: selectedRange.start,
      end: selectedRange.end,
    };
    const updated = { ...existing, ...patch };
    const nextMarks = block.marks.filter((mark) => !(mark.start === selectedRange.start && mark.end === selectedRange.end));
    nextMarks.push(updated);
    updateBlock(block.id, { marks: nextMarks });
  };
  const toggleMark = (key: "bold" | "italic" | "underline") => {
    const block = form.blocks.find((item) => item.id === selectedRange?.blockId);
    const current = block?.marks.find((mark) => mark.start === selectedRange?.start && mark.end === selectedRange?.end);
    const enabled = !current?.[key];
    if (key === "bold") applyMark({ bold: enabled });
    else if (key === "italic") applyMark({ italic: enabled });
    else applyMark({ underline: enabled });
  };

  const errors = {
    title: !form.title.trim() ? t("adminPortfolio.errTitle") : undefined,
    project_url: form.project_url && !/^https?:\/\/\S+$/i.test(form.project_url.trim()) ? t("adminPortfolio.errProjectUrl") : undefined,
    logo_url: form.logo_url && !/^https?:\/\/\S+$/i.test(form.logo_url.trim()) ? t("adminPortfolio.errMediaUrl") : undefined,
  };
  const badBlockUrls = form.blocks.map((block) => block.type !== "text" && !/^https?:\/\/\S+$/i.test((block.url ?? "").trim()));
  const hasErrors = Boolean(errors.title || errors.project_url || errors.logo_url) || badBlockUrls.some(Boolean);

  function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (hasErrors || save.isPending) return;
    const media = form.blocks
      .filter((block) => block.type !== "text" && block.url)
      .map((block) => ({ url: block.url!.trim(), media_type: block.type as "image" | "video" | "file", caption: block.caption?.trim() || null }));
    save.mutate({
      id: project?.id,
      input: {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        client_name: form.client_name?.trim() || null,
        project_url: form.project_url?.trim() || null,
        logo_url: form.logo_url?.trim() || null,
        media,
        blocks: form.blocks.map((block) => ({ ...block, url: block.url?.trim() || null, caption: block.caption?.trim() || null })),
      },
    }, { onSuccess: onClose });
  }

  return (
    <form onSubmit={submit} noValidate className="ajr-portfolio-editor">
      <div className="ajr-portfolio-editor-heading">
        <div><p className="ajr-admin-kicker">{t("adminPortfolio.editorKicker")}</p><h2>{project ? t("adminPortfolio.editProject") : t("adminPortfolio.newProject")}</h2></div>
        <button type="button" onClick={onClose} className="ajr-editor-close" aria-label={t("adminPortfolio.cancel")}><X aria-hidden /></button>
      </div>

      <section className="ajr-editor-section">
        <div className="ajr-editor-section-heading"><span>01</span><div><h3>{t("adminPortfolio.projectBasics")}</h3><p>{t("adminPortfolio.projectBasicsHint")}</p></div></div>
        <div className="ajr-editor-grid">
          <label className="ajr-editor-field ajr-editor-field--wide"><span>{t("adminPortfolio.fieldTitle")}</span><input value={form.title} onChange={(event) => setField("title", event.target.value)} maxLength={200} required aria-invalid={showErrors && Boolean(errors.title)} /></label>
          <label className="ajr-editor-field"><span>{t("adminPortfolio.fieldStatus")}</span><select value={form.status} onChange={(event) => setField("status", event.target.value as ProjectStatus)}>{STATUS_KEYS.map((key) => <option key={key} value={key}>{t(STATUS_LABEL_KEY[key])}</option>)}</select></label>
          <label className="ajr-editor-field ajr-editor-field--wide"><span>{t("adminPortfolio.fieldDescriptionShort")}</span><textarea value={form.description} onChange={(event) => setField("description", event.target.value.slice(0, 320))} maxLength={320} rows={2} placeholder={t("adminPortfolio.summaryPlaceholder")} /><small>{form.description.length}/320</small></label>
          <label className="ajr-editor-field"><span>{t("adminPortfolio.fieldClient")}</span><input value={form.client_name ?? ""} onChange={(event) => setField("client_name", event.target.value)} maxLength={200} /></label>
          <label className="ajr-editor-field"><span>{t("adminPortfolio.fieldProjectUrl")}</span><input value={form.project_url ?? ""} onChange={(event) => setField("project_url", event.target.value)} placeholder="https://" aria-invalid={showErrors && Boolean(errors.project_url)} /></label>
          <label className="ajr-editor-field ajr-editor-field--wide"><span>{t("adminPortfolio.logoUrl")}</span><input value={form.logo_url ?? ""} onChange={(event) => setField("logo_url", event.target.value)} placeholder="https://…" aria-invalid={showErrors && Boolean(errors.logo_url)} /></label>
        </div>
        {showErrors && (errors.title || errors.project_url || errors.logo_url) && <p role="alert" className="ajr-editor-error">{errors.title || errors.project_url || errors.logo_url}</p>}
      </section>

      <section className="ajr-editor-section">
        <div className="ajr-editor-section-heading"><span>02</span><div><h3>{t("adminPortfolio.layoutAndBlocks")}</h3><p>{t("adminPortfolio.layoutHint", { count: form.blocks.length, max: MAX_PORTFOLIO_BLOCKS })} · {t("adminPortfolio.mediaLimit", { count: mediaBlockCount, max: MAX_GALLERY_ITEMS })}</p></div></div>
        <div className="ajr-editor-add-blocks">
          <button type="button" onClick={() => addBlock("text")} disabled={form.blocks.length >= MAX_PORTFOLIO_BLOCKS}><Type />{t("adminPortfolio.addTextBlock")}</button>
          <button type="button" onClick={() => addBlock("image")} disabled={form.blocks.length >= MAX_PORTFOLIO_BLOCKS || mediaBlockCount >= MAX_GALLERY_ITEMS}><ImagePlus />{t("adminPortfolio.addImageBlock")}</button>
          <button type="button" onClick={() => addBlock("video")} disabled={form.blocks.length >= MAX_PORTFOLIO_BLOCKS || mediaBlockCount >= MAX_GALLERY_ITEMS}><Video />{t("adminPortfolio.addVideoBlock")}</button>
          <button type="button" onClick={() => addBlock("file")} disabled={form.blocks.length >= MAX_PORTFOLIO_BLOCKS || mediaBlockCount >= MAX_GALLERY_ITEMS}><FileText />{t("adminPortfolio.addFileBlock")}</button>
        </div>
        {form.blocks.length === 0 && <div className="ajr-editor-empty-blocks"><Layers3 /><strong>{t("adminPortfolio.emptyBlocks")}</strong><span>{t("adminPortfolio.emptyBlocksHint")}</span></div>}

        <div className="ajr-editor-block-list">
          {form.blocks.map((block, index) => (
            <article key={block.id} className="ajr-editor-block" draggable onDragStart={() => { draggedBlockId.current = block.id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderBlock(block.id)} onDragEnd={() => { draggedBlockId.current = null; }}>
              <header className="ajr-editor-block-heading">
                <span className="ajr-editor-drag" title={t("adminPortfolio.dragToReorder")}><GripVertical /></span>
                <span className="ajr-editor-block-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{t(`adminPortfolio.blockType.${block.type}`)}</strong>
                <span className="ajr-editor-block-limit">{block.type === "text" ? `${block.text.length}/${BLOCK_TEXT_LIMITS[block.size]}` : t("adminPortfolio.visualBlock")}</span>
                <div className="ajr-editor-block-actions">
                  <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0} aria-label={t("adminPortfolio.moveBlockUp")}><ArrowUp /></button>
                  <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === form.blocks.length - 1} aria-label={t("adminPortfolio.moveBlockDown")}><ArrowDown /></button>
                  <button type="button" onClick={() => setField("blocks", form.blocks.filter((item) => item.id !== block.id))} aria-label={t("adminPortfolio.removeBlock")}><Trash2 /></button>
                </div>
              </header>
              <div className="ajr-editor-block-controls">
                <label className="ajr-editor-field"><span>{t("adminPortfolio.blockSize")}</span><select value={block.size} onChange={(event) => updateBlock(block.id, { size: event.target.value as PortfolioBlockSize })}>{SIZE_KEYS.map((size) => <option key={size} value={size}>{t(`adminPortfolio.blockSizeNames.${size}`)} · {BLOCK_TEXT_LIMITS[size]} {t("adminPortfolio.characters")}</option>)}</select></label>
                {block.type === "text" ? (
                  <div className="ajr-editor-rich-text">
                    <div className="ajr-editor-format-toolbar">
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleMark("bold")} title={t("adminPortfolio.bold")}><Bold /></button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleMark("italic")} title={t("adminPortfolio.italic")}><Italic /></button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleMark("underline")} title={t("adminPortfolio.underline")}><UnderlineIcon /></button>
                      <input type="color" value={markColor} onChange={(event) => setMarkColor(event.target.value)} aria-label={t("adminPortfolio.solidColor")} />
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyMark({ color: markColor, gradient_start: null, gradient_end: null })}>{t("adminPortfolio.applyColor")}</button>
                      <input type="color" value={gradientStart} onChange={(event) => setGradientStart(event.target.value)} aria-label={t("adminPortfolio.gradientStart")} />
                      <input type="color" value={gradientEnd} onChange={(event) => setGradientEnd(event.target.value)} aria-label={t("adminPortfolio.gradientEnd")} />
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyMark({ color: null, gradient_start: gradientStart, gradient_end: gradientEnd })}>{t("adminPortfolio.applyGradient")}</button>
                    </div>
                    <textarea
                      value={block.text}
                      maxLength={BLOCK_TEXT_LIMITS[block.size]}
                      rows={4}
                      placeholder={t("adminPortfolio.blockTextPlaceholder")}
                      onSelect={(event) => setSelectedRange({ blockId: block.id, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
                      onChange={(event) => updateBlock(block.id, { text: event.target.value, marks: [] })}
                    />
                    <small>{t("adminPortfolio.selectTextHint")}</small>
                  </div>
                ) : (
                  <div className="ajr-editor-media-fields">
                    <label className="ajr-editor-field"><span>{t("adminPortfolio.mediaUrl")}</span><input value={block.url ?? ""} onChange={(event) => updateBlock(block.id, { url: event.target.value })} placeholder="https://…" aria-invalid={showErrors && badBlockUrls[index]} /></label>
                    <label className="ajr-editor-field"><span>{t("adminPortfolio.captionPlaceholder")}</span><input value={block.caption ?? ""} onChange={(event) => updateBlock(block.id, { caption: event.target.value })} maxLength={300} /></label>
                    {block.type === "image" && <label className="ajr-editor-field"><span>{t("adminPortfolio.imageFit")}</span><select value={block.fit} onChange={(event) => updateBlock(block.id, { fit: event.target.value as "contain" | "cover" })}><option value="contain">{t("adminPortfolio.fitContain")}</option><option value="cover">{t("adminPortfolio.fitCover")}</option></select></label>}
                  </div>
                )}
                <div className="ajr-editor-block-palette">
                  <ColorField label={t("adminPortfolio.blockBackground")} value={block.background_color} onChange={(value) => updateBlock(block.id, { background_color: value })} />
                  <ColorField label={t("adminPortfolio.blockBorder")} value={block.border_color} onChange={(value) => updateBlock(block.id, { border_color: value })} />
                  {block.type === "text" && <ColorField label={t("adminPortfolio.blockTextColor")} value={block.text_color} onChange={(value) => updateBlock(block.id, { text_color: value })} />}
                </div>
              </div>
            </article>
          ))}
        </div>
        {showErrors && badBlockUrls.some(Boolean) && <p role="alert" className="ajr-editor-error">{t("adminPortfolio.errMediaUrl")}</p>}
      </section>

      <section className="ajr-editor-section">
        <button type="button" className="ajr-editor-section-heading ajr-editor-accordion" onClick={() => setShowGlobalStyle((value) => !value)} aria-expanded={showGlobalStyle}>
          <span>03</span><div><h3>{t("adminPortfolio.projectPalette")}</h3><p>{t("adminPortfolio.projectPaletteHint")}</p></div>{showGlobalStyle ? <EyeOff /> : <Eye />}
        </button>
        {showGlobalStyle && <div className="ajr-editor-palette-grid">
          <ColorField label={t("adminPortfolio.projectBackground")} value={form.style.background_color} onChange={(value) => setField("style", { ...form.style, background_color: value })} />
          <ColorField label={t("adminPortfolio.projectBorder")} value={form.style.border_color} onChange={(value) => setField("style", { ...form.style, border_color: value })} />
          <ColorField label={t("adminPortfolio.projectAccent")} value={form.style.accent_color} onChange={(value) => setField("style", { ...form.style, accent_color: value })} />
          <ColorField label={t("adminPortfolio.projectText")} value={form.style.text_color} onChange={(value) => setField("style", { ...form.style, text_color: value })} />
        </div>}
      </section>

      {save.isError && <p role="alert" className="ajr-editor-error">{getServerDetail(save.error) ?? t("adminPortfolio.saveError")}</p>}
      <footer className="ajr-editor-footer">
        <button type="submit" disabled={save.isPending} className="ajr-editor-save"><Save aria-hidden />{save.isPending ? t("adminPortfolio.saving") : t("adminPortfolio.save")}</button>
        <button type="button" onClick={onClose} className="ajr-editor-cancel">{t("adminPortfolio.cancel")}</button>
      </footer>
    </form>
  );
}

export default function AdminPortfolio() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useProjects();
  const remove = useDeleteProject();
  const reorder = useReorderProjects();
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const draggedProjectId = useRef<number | null>(null);
  const isAdmin = me?.role === "ADMIN";
  const orderDirty = useMemo(() => Boolean(data && (data.length !== orderedIds.length || data.some((project, index) => project.id !== orderedIds[index]))), [data, orderedIds]);
  const orderedProjects = useMemo(() => {
    const byId = new Map((data ?? []).map((project) => [project.id, project]));
    return orderedIds.map((id) => byId.get(id)).filter((project): project is Project => Boolean(project));
  }, [data, orderedIds]);

  useEffect(() => {
    if (data) setOrderedIds(data.map((project) => project.id));
  }, [data]);

  const moveProject = (projectId: number, delta: -1 | 1) => {
    setOrderedIds((current) => {
      const next = [...current];
      const index = next.indexOf(projectId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const dropProject = (targetId: number) => {
    const sourceId = draggedProjectId.current;
    draggedProjectId.current = null;
    if (sourceId === null || sourceId === targetId) return;
    setOrderedIds((current) => {
      const next = [...current];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <div className="ajr-admin-portfolio mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="ajr-admin-portfolio-header">
        <div><p className="ajr-admin-kicker">AJR DATA / CMS</p><h1>{t("adminPortfolio.title")}</h1><p>{t("adminPortfolio.subtitleHaniel")}</p></div>
        {editing === null && <button type="button" onClick={() => setEditing("new")} className="ajr-admin-new-project"><Plus aria-hidden />{t("adminPortfolio.newProject")}</button>}
      </header>

      {editing !== null && <Editor key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {isLoading && <p className="text-fg-subtle">{t("adminCommon.loading")}</p>}
      {isError && <p role="alert" className="text-red-600 dark:text-red-400">{t("adminPortfolio.loadError")} <button onClick={() => refetch()} className="font-medium underline">{t("adminCommon.retry")}</button></p>}
      {remove.isError && <p role="alert" className="ajr-editor-error">{getServerDetail(remove.error) ?? t("adminPortfolio.deleteError")}</p>}
      {reorder.isError && <p role="alert" className="ajr-editor-error">{getServerDetail(reorder.error) ?? t("adminPortfolio.reorderError")}</p>}
      {data && data.length === 0 && editing === null && <p className="ajr-admin-portfolio-empty">{t("adminPortfolio.empty")}</p>}

      {Boolean(data?.length) && (
        <section className="ajr-admin-order-section">
          <div className="ajr-admin-order-heading"><div><p className="ajr-admin-kicker">{t("adminPortfolio.priorityKicker")}</p><h2>{t("adminPortfolio.priorityTitle")}</h2><p>{t("adminPortfolio.priorityHint")}</p></div>
            <button type="button" onClick={() => reorder.mutate(orderedIds)} disabled={!orderDirty || reorder.isPending} className="ajr-admin-save-order"><Check aria-hidden />{reorder.isPending ? t("adminPortfolio.savingOrder") : t("adminPortfolio.saveOrder")}</button>
          </div>
          <ol className="ajr-admin-project-order">
            {orderedProjects.map((project, index) => (
              <li key={project.id} draggable onDragStart={() => { draggedProjectId.current = project.id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => dropProject(project.id)} onDragEnd={() => { draggedProjectId.current = null; }}>
                <span className="ajr-admin-project-grip" title={t("adminPortfolio.dragToReorder")}><GripVertical /></span>
                <span className="ajr-admin-project-priority">{String(index + 1).padStart(2, "0")}</span>
                <span className="ajr-admin-project-thumb" style={{ backgroundColor: project.style.background_color, borderColor: project.style.border_color }}>
                  {project.logo_url || project.image_url ? <img src={project.logo_url || project.image_url || ""} alt="" /> : <Layers3 />}
                </span>
                <span className="ajr-admin-project-info"><strong>{project.title}</strong><small>{t(STATUS_LABEL_KEY[project.status])} · {project.blocks.length || project.media.length} {t("adminPortfolio.contentBlocks")}</small></span>
                <span className="ajr-admin-project-controls">
                  <button type="button" onClick={() => moveProject(project.id, -1)} disabled={index === 0} title={t("adminPortfolio.moveProjectUp")}><ArrowUp /></button>
                  <button type="button" onClick={() => moveProject(project.id, 1)} disabled={index === orderedProjects.length - 1} title={t("adminPortfolio.moveProjectDown")}><ArrowDown /></button>
                </span>
                <span className="ajr-admin-project-actions">
                  <button type="button" onClick={() => { setEditing(project); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Layers3 aria-hidden />{t("adminPortfolio.openEditor")}</button>
                  {isAdmin && <ConfirmButton label={t("adminPortfolio.delete")} question={t("adminPortfolio.deleteQuestion")} confirmLabel={t("adminPortfolio.deleteConfirm")} onConfirm={() => remove.mutate(project.id)} disabled={remove.isPending} icon={<Trash2 className="h-4 w-4" aria-hidden />} />}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
