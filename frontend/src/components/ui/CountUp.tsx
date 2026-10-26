import { useEffect, useState } from "react";
import { useInView } from "@/lib/useInView";

/** Número que cuenta desde 0 hasta `value` al entrar en el viewport (sin animación si el usuario pidió menos movimiento). */
export default function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {inView ? shown.toLocaleString() : 0}
    </span>
  );
}
