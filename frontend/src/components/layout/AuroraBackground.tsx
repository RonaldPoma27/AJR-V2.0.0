import { useEffect, useRef } from "react";

/**
 * Fondo decorativo (no recibe clics ni lo leen los lectores de pantalla). Capas:
 *  1. Luces difusas (aurora) que derivan solas (CSS).
 *  2. Un tinte fijo de color.
 *  3. Partículas: pocas y lentas en móvil; más y más rápidas desde 1024px (ver index.css).
 *
 * Parallax (2.4.1): al hacer scroll, las luces y las partículas suben a distinta velocidad
 * (`transform: translateY()`), así el fondo tiene profundidad y no queda estático. Cada capa es más
 * alta que la pantalla y su desplazamiento se limita a ese excedente, para que nunca se vea el borde.
 * Se salta con "reducir movimiento". Se actualiza con requestAnimationFrame y sin re-renderizar React.
 */
interface ParallaxLayer {
  /** Píxeles que sube la capa por cada píxel de scroll (menor = más lejos, más lento). */
  speed: number;
  /** Excedente de alto de la capa respecto de la pantalla (h-[120%] → 0.2): tope del desplazamiento. */
  overflow: number;
}
const SLOW: ParallaxLayer = { speed: 0.08, overflow: 0.2 }; // luces: h-[120%]
const FAST: ParallaxLayer = { speed: 0.18, overflow: 0.45 }; // partículas: h-[145%]

const blobs = [
  { pos: "left-[-6rem] top-0 h-80 w-80 bg-sky-300 dark:bg-blue-700", delay: "0s" },
  { pos: "right-[-5rem] top-1/4 h-96 w-96 bg-violet-300 dark:bg-indigo-700", delay: "-6s" },
  { pos: "bottom-0 left-1/4 h-72 w-72 bg-cyan-200 dark:bg-cyan-800", delay: "-12s" },
];

// [x %, y %, tamaño px, duración s, delay s]
const particles: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [33.1, 15.1, 2, 16, -26],
  [53.4, 36.6, 2, 30, -6],
  [5.6, 43.4, 2, 21, -2],
  [54.9, 5.9, 2, 21, -20],
  [62.2, 94.8, 5, 15, -7],
  [6.5, 85.8, 4, 27, -4],
  [53.9, 57.1, 3, 17, -18],
  [56.8, 18.8, 2, 31, -22],
  [8.0, 6.0, 3, 29, -21],
  [53.0, 77.7, 5, 32, -29],
  [45.5, 30.0, 3, 21, -2],
  [57.1, 52.5, 4, 28, -9],
  [60.5, 7.3, 5, 19, -24],
  [34.8, 93.3, 5, 15, -30],
  [66.1, 76.5, 4, 24, -22],
  [35.6, 49.7, 5, 16, -26],
  [11.0, 27.0, 2, 15, -23],
  [69.3, 64.7, 5, 23, -22],
  [39.0, 66.9, 2, 28, -11],
  [18.1, 11.7, 2, 20, -24],
  [29.6, 73.8, 5, 26, -29],
  [85.7, 8.1, 5, 26, -17],
  [28.7, 13.7, 5, 31, -8],
  [69.8, 98.6, 5, 21, -4],
  [10.0, 15.1, 3, 14, -15],
  [81.8, 18.2, 4, 14, -4],
  [42.2, 36.9, 4, 18, -22],
  [84.5, 95.0, 2, 28, -28],
  [85.6, 95.2, 5, 26, -12],
  [39.8, 48.2, 5, 15, -6],
  [8.5, 20.9, 3, 17, -10],
  [59.7, 10.2, 3, 31, -3],
  [93.1, 61.4, 2, 20, -19],
  [38.1, 63.4, 4, 25, -15],
  [13.8, 84.9, 5, 29, -15],
  [31.9, 14.4, 4, 22, -15],
];

export default function AuroraBackground() {
  const slowRef = useRef<HTMLDivElement>(null);
  const fastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const apply = (el: HTMLDivElement | null, layer: ParallaxLayer, scrollY: number, vh: number) => {
      if (!el) return;
      const offset = Math.min(Math.max(scrollY, 0) * layer.speed, layer.overflow * vh);
      el.style.transform = `translateY(${-offset.toFixed(1)}px)`;
    };

    const update = () => {
      frame = 0;
      if (reduce.matches) {
        if (slowRef.current) slowRef.current.style.transform = "";
        if (fastRef.current) fastRef.current.style.transform = "";
        return;
      }
      const { scrollY, innerHeight } = window;
      apply(slowRef.current, SLOW, scrollY, innerHeight);
      apply(fastRef.current, FAST, scrollY, innerHeight);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update(); // posición inicial correcta si la página carga ya scrolleada (recarga, ancla)
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    reduce.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reduce.removeEventListener("change", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div ref={slowRef} className="story-layer absolute inset-x-0 top-0 h-[120%]">
        {blobs.map((b) => (
          <div
            key={b.delay}
            style={{ animationDelay: b.delay }}
            className={`absolute animate-blob rounded-full opacity-30 blur-3xl dark:opacity-25 ${b.pos}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-400/10 to-sky-400/20 dark:via-indigo-500/10 dark:to-blue-500/20" />
      <div ref={fastRef} className="story-layer absolute inset-x-0 top-0 h-[145%]">
        {particles.map(([x, y, size, dur, delay], i) => (
          <span
            key={i}
            className="particle"
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size,
                "--dur": `${dur}s`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
