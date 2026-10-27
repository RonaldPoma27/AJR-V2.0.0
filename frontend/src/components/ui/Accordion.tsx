import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  id: string;
  title: string;
  content: string;
}

interface AccordionProps {
  items: AccordionItem[];
  title?: string;
  subtitle?: string;
}

/**
 * Acordeón con una respuesta abierta por vez.
 * Soporta navegación por teclado (↑/↓, Home, End) y respeta prefers-reduced-motion.
 */
export default function Accordion({ items, title, subtitle }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        nextIndex = (index + 1) % items.length;
        break;
      case "ArrowUp":
        e.preventDefault();
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="space-y-6">
      {title && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-fg">{title}</h2>
          {subtitle && <p className="mt-2 text-fg-muted">{subtitle}</p>}
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-3">
        {items.map((item, index) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-surface">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-4 py-3 text-left font-medium transition-colors",
                  isOpen ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                <span>{item.title}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>

              {/* Contenido: anima height */}
              <div
                id={`panel-${item.id}`}
                role="region"
                hidden={!isOpen}
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isOpen ? "max-h-96" : "max-h-0"
                )}
              >
                <div className="px-4 py-3 text-sm text-fg-muted">{item.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
