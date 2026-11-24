import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  id: string;
  title: string;
  /** Línea breve visible aun con el panel cerrado. */
  summary?: string;
  content: ReactNode;
}

/**
 * Acordeón accesible (patrón WAI-ARIA): cada cabecera es un `button` con `aria-expanded` /
 * `aria-controls`, el panel es una `region` etiquetada, y las flechas / Home / End mueven el foco.
 * Un único panel abierto por defecto (`multiple` permite varios). Animación vía CSS grid
 * (`.ajr-acc-panel`), desactivada con `prefers-reduced-motion`.
 * McCall: Usabilidad (teclado + lectores de pantalla), Reusabilidad (sin dependencias del dominio).
 */
export default function Accordion({
  items,
  multiple = false,
  defaultOpen,
  className,
  label,
}: {
  items: AccordionItem[];
  multiple?: boolean;
  defaultOpen?: string;
  className?: string;
  label?: string;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ? [defaultOpen] : []));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(multiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const target =
      event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    buttons.current[target]?.focus();
  };

  return (
    <div className={cn("space-y-2", className)} role="group" aria-label={label}>
      {items.map((item, index) => {
        const isOpen = open.has(item.id);
        const triggerId = `${baseId}-t-${item.id}`;
        const panelId = `${baseId}-p-${item.id}`;
        return (
          <div key={item.id} className={cn("rounded-xl border border-white/10 bg-white/[0.03] transition-colors", isOpen && "border-cyan-300/30 bg-white/[0.06]")}>
            <h3>
              <button
                ref={(el) => { buttons.current[index] = el; }}
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left focus-visible:outline-offset-[-3px]"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-fg">{item.title}</span>
                  {item.summary && <span className="mt-0.5 block text-sm font-normal text-fg-subtle">{item.summary}</span>}
                </span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-accent transition-transform duration-300 motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={triggerId} data-open={isOpen} aria-hidden={!isOpen} className="ajr-acc-panel">
              <div className="ajr-acc-inner">
                <div className="px-4 pb-4 text-sm text-fg-muted">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
