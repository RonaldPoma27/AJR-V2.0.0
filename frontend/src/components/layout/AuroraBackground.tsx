import { cn } from "@/lib/utils";

const blobs = [
  { className: "left-[-6rem] top-0 h-80 w-80 bg-sky-300 dark:bg-blue-700", delay: "0s" },
  { className: "right-[-5rem] top-1/4 h-96 w-96 bg-violet-300 dark:bg-indigo-700", delay: "-6s" },
  { className: "bottom-0 left-1/4 h-72 w-72 bg-cyan-200 dark:bg-cyan-800", delay: "-12s" },
  { className: "bottom-1/4 right-1/4 h-64 w-64 bg-blue-200 dark:bg-violet-800", delay: "-3s" },
];

/** Luces difusas que se mueven por el fondo (efecto aurora). Decorativo: no recibe clicks ni lo leen los lectores de pantalla. */
export default function AuroraBackground() {
  return (
    <div aria-hidden className="ajr-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((b) => (
        <div
          key={b.delay}
          style={{ animationDelay: b.delay }}
          className={cn("absolute animate-blob rounded-full opacity-30 blur-3xl dark:opacity-25", b.className)}
        />
      ))}
    </div>
  );
}
