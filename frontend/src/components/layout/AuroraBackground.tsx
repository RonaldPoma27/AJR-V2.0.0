import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const blobs = [
  { className: "left-[-7rem] top-[-2rem] h-80 w-80 ajr-aurora-blob--cyan", delay: "0s" },
  { className: "right-[-6rem] top-1/4 h-96 w-96 ajr-aurora-blob--violet", delay: "-6s" },
  { className: "bottom-0 left-1/4 h-72 w-72 ajr-aurora-blob--blue", delay: "-12s" },
  { className: "bottom-1/4 right-1/4 h-64 w-64 ajr-aurora-blob--cyan-soft", delay: "-3s" },
];

/** Luces difusas de fondo con parallax ligero; la decoración no intercepta la interacción. */
export default function AuroraBackground() {
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrollOffset(Math.min(window.scrollY * 0.055, 96)));
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
        {blobs.map((blob) => (
          <div
            key={blob.delay}
            style={{ animationDelay: blob.delay }}
            className={cn("absolute animate-blob rounded-full blur-3xl ajr-aurora-blob", blob.className)}
          />
        ))}
      </div>
    </div>
  );
}
