import { useCallback, type CSSProperties, type ElementType, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sistema Bento: grilla asimétrica de 6 columnas (desktop), 2 (tablet) y 1 (móvil).
 * Cada tarjeta declara su tamaño con `cols` y `rows`; la grilla las encastra (`grid-flow-dense`).
 * El brillo sigue al puntero: `--mx` / `--my` se actualizan en cada movimiento y los consume el CSS
 * (`.ajr-bento-card::before` para el interior y `::after` para el borde).
 */
export type BentoSpan = 1 | 2 | 3 | 4 | 5 | 6;
export type BentoRows = 1 | 2 | 3;
export type BentoAccent = "cyan" | "violet" | "blue";

// Clases completas y estáticas: Tailwind no detecta nombres armados con template strings.
const COLS: Record<BentoSpan, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
};
const TABLET_COLS: Record<BentoSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-1",
  3: "md:col-span-1",
  4: "md:col-span-2",
  5: "md:col-span-2",
  6: "md:col-span-2",
};
const ROWS: Record<BentoRows, string> = {
  1: "",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
};

export function BentoGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ajr-bento-grid", className)} {...rest} />;
}

interface BentoCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: ElementType;
  cols?: BentoSpan;
  rows?: BentoRows;
  accent?: BentoAccent;
  /** Animación de aparición ligada al scroll (CSS `animation-timeline: view()`). */
  scrollReveal?: boolean;
  children: ReactNode;
}

export function BentoCard({
  as: Tag = "div",
  cols = 2,
  rows = 1,
  accent = "cyan",
  scrollReveal = true,
  className,
  children,
  onPointerMove,
  ...rest
}: BentoCardProps) {
  const handleMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
      onPointerMove?.(event);
    },
    [onPointerMove]
  );

  return (
    <Tag
      data-accent={accent}
      onPointerMove={handleMove}
      style={{ "--mx": "50%", "--my": "0%" } as CSSProperties}
      className={cn(
        "ajr-bento-card md:col-span-1",
        TABLET_COLS[cols],
        COLS[cols],
        ROWS[rows],
        scrollReveal && "ajr-scroll-reveal",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
