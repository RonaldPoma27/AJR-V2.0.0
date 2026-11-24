import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Renderizador Markdown mínimo y SEGURO para los textos legales propios.
 *
 * - No usa `dangerouslySetInnerHTML`: todo se emite como nodos React (XSS imposible por diseño).
 * - Soporta lo que usan los documentos: `#`..`####`, párrafos, listas `-` / `1.`, `>` citas,
 *   `---`, **negrita**, *cursiva*, `código` y [enlaces](url). Los enlaces solo admiten
 *   `/ruta`, `https:` y `mailto:`; cualquier otro esquema se muestra como texto plano.
 * - Sin dependencias: evita sumar superficie de ataque y peso al bundle (Eficiencia / Integridad).
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^(https:\/\/|mailto:)/i.test(href)) return href;
  return null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      return href.startsWith("/") ? (
        <Link key={key} to={href}>{link[1]}</Link>
      ) : (
        <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{link[1]}</a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { type: "h"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" };

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (heading) { flushPara(); flushList(); blocks.push({ type: "h", level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2] }); continue; }
    if (/^---+$/.test(line.trim())) { flushPara(); flushList(); blocks.push({ type: "hr" }); continue; }
    if (line.startsWith(">")) { flushPara(); flushList(); blocks.push({ type: "quote", text: line.replace(/^>\s?/, "") }); continue; }
    if (bullet || ordered) {
      flushPara();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet ?? ordered)![1]);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export default function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.type) {
          case "h": {
            const Tag = (`h${block.level}`) as "h1" | "h2" | "h3" | "h4";
            return <Tag key={key}>{inline(block.text, key)}</Tag>;
          }
          case "p": return <p key={key}>{inline(block.text, key)}</p>;
          case "quote": return <blockquote key={key}>{inline(block.text, key)}</blockquote>;
          case "hr": return <hr key={key} />;
          case "ul":
          case "ol": {
            const List = block.type;
            return <List key={key}>{block.items.map((item, j) => <li key={`${key}-${j}`}>{inline(item, `${key}-${j}`)}</li>)}</List>;
          }
        }
      })}
    </div>
  );
}
