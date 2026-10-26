import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const blobs = [
  { className: "left-[-6rem] top-0 h-80 w-80 bg-sky-300 dark:bg-blue-700", delay: "0s" },
  { className: "right-[-5rem] top-1/4 h-96 w-96 bg-violet-300 dark:bg-indigo-700", delay: "-6s" },
  { className: "bottom-0 left-1/4 h-72 w-72 bg-cyan-200 dark:bg-cyan-800", delay: "-12s" },
  { className: "bottom-1/4 right-1/4 h-64 w-64 bg-blue-200 dark:bg-violet-800", delay: "-3s" },
];

/** Luces difusas decorativas con animación de aurora y parallax suave al desplazarse. */
export default function AuroraBackground() {
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollOffset(Math.min(window.scrollY * 0.08, 120)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="ajr-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `translate3d(0, -${scrollOffset}px, 0)` }}>
        {blobs.map((b) => (
          <div
            key={b.delay}
            style={{ animationDelay: b.delay }}
            className={cn("absolute animate-blob rounded-full opacity-30 blur-3xl dark:opacity-25", b.className)}
          />
        ))}
      </div>
    </div>
  );
}
