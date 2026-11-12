import { useMemo } from "react";
import { FileText, Info, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  eyebrow: string;
  document: string;
  updatedAt: string;
};

type InlinePart = string | { kind: "strong" | "code" | "link"; text: string; href?: string };

function parseInline(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const token = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(source.slice(cursor, index));
    const value = match[0];
    if (value.startsWith("**")) {
      parts.push({ kind: "strong", text: value.slice(2, -2) });
    } else if (value.startsWith("`")) {
      parts.push({ kind: "code", text: value.slice(1, -1) });
    } else {
      const link = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) parts.push({ kind: "link", text: link[1], href: link[2] });
    }
    cursor = index + value.length;
  }
  if (cursor < source.length) parts.push(source.slice(cursor));
  return parts;
}

function InlineText({ value }: { value: string }) {
  return <>{parseInline(value).map((part, index) => {
    if (typeof part === "string") return <span key={index}>{part}</span>;
    if (part.kind === "strong") return <strong key={index} className="font-semibold text-white">{part.text}</strong>;
    if (part.kind === "code") return <code key={index} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-100">{part.text}</code>;
    const href = part.href ?? "#";
    const internal = href.startsWith("/") && !href.startsWith("//");
    const safeExternal = /^(https:\/\/|mailto:)/i.test(href);
    const safeHref = internal || safeExternal ? href : "#";
    return <a key={index} href={safeHref} target={!internal && safeExternal && href.startsWith("https://") ? "_blank" : undefined} rel={!internal && safeExternal && href.startsWith("https://") ? "noreferrer noopener" : undefined} className="text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-cyan-100">{part.text}</a>;
  })}</>;
}

function MarkdownContent({ source }: { source: string }) {
  const blocks = useMemo(() => {
    const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
    const parsed: Array<{ type: "heading" | "paragraph" | "quote" | "list" | "rule"; level?: number; value: string | string[] }> = [];
    let paragraph: string[] = [];
    let list: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) parsed.push({ type: "paragraph", value: paragraph.join(" ").trim() });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) parsed.push({ type: "list", value: [...list] });
      list = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { flushParagraph(); flushList(); continue; }
      if (/^---+$/.test(line)) { flushParagraph(); flushList(); parsed.push({ type: "rule", value: "" }); continue; }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        parsed.push({ type: "heading", level: heading[1].length, value: heading[2] });
        continue;
      }
      if (line.startsWith(">")) {
        flushParagraph(); flushList();
        parsed.push({ type: "quote", value: line.replace(/^>\s?/, "") });
        continue;
      }
      const item = line.match(/^[-*]\s+(.+)$/);
      if (item) { flushParagraph(); list.push(item[1]); continue; }
      flushList();
      paragraph.push(line);
    }
    flushParagraph(); flushList();
    return parsed;
  }, [source]);

  return <div className="legal-markdown">
    {blocks.map((block, index) => {
      if (block.type === "rule") return <hr key={index} className="my-7 border-white/10" />;
      if (block.type === "list") return <ul key={index} className="my-4 list-disc space-y-2 pl-6 text-sm leading-7 text-slate-300">{(block.value as string[]).map((item, itemIndex) => <li key={itemIndex}><InlineText value={item} /></li>)}</ul>;
      if (block.type === "quote") return <blockquote key={index} className="my-5 rounded-r-xl border-l-2 border-cyan-300/60 bg-cyan-300/[0.055] px-4 py-3 text-sm leading-7 text-slate-300"><InlineText value={block.value as string} /></blockquote>;
      if (block.type === "heading") {
        const level = block.level ?? 2;
        if (level === 1) return null; // el H1 accesible y único lo aporta la página.
        if (level === 2) return <h2 key={index} className="mb-3 mt-9 border-b border-white/[0.08] pb-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"><InlineText value={block.value as string} /></h2>;
        return <h3 key={index} className="mb-2 mt-6 text-base font-semibold text-cyan-100"><InlineText value={block.value as string} /></h3>;
      }
      return <p key={index} className="my-3 text-sm leading-7 text-slate-300"><InlineText value={block.value as string} /></p>;
    })}
  </div>;
}

export default function LegalDocumentPage({ title, eyebrow, document, updatedAt }: Props) {
  const hasPendingFields = /\[[^\]]*(RAZÓN SOCIAL|CUIT|DOMICILIO|EMAIL|TITULAR)[^\]]*\]/i.test(document);
  return (
    <article className="mx-auto w-full max-w-5xl px-1 py-5 sm:px-3 sm:py-8" aria-labelledby="legal-title">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
        <FileText className="h-4 w-4" aria-hidden="true" />{eyebrow}
      </div>
      <header className="ajr-legal-hero mb-5 rounded-[1.5rem] border border-white/10 px-6 py-8 sm:px-9 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">AJR DATA · HERCULES 3.5</p>
        <h1 id="legal-title" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{updatedAt}</p>
      </header>

      {hasPendingFields && <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>Documento en borrador: antes de publicarlo deben completarse los campos de identificación y contacto que aparecen entre corchetes y validar el texto con asesoramiento jurídico.</p>
      </div>}

      <section className="ajr-legal-document rounded-[1.5rem] border border-white/10 bg-[#0c1422]/85 px-5 py-6 shadow-[0_18px_60px_rgba(0,0,0,.18)] sm:px-9 sm:py-9">
        <MarkdownContent source={document} />
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Info className="h-4 w-4" aria-hidden="true" />
        <span>Los documentos publicados son informativos y no reemplazan el acuerdo particular ni las normas imperativas aplicables.</span>
        <Link to="/arrepentimiento" className="ml-auto font-semibold text-cyan-200 underline underline-offset-4">Botón de arrepentimiento</Link>
      </div>
    </article>
  );
}
