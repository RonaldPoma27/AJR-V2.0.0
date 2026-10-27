import { useEffect, useRef, useState } from "react";

/**
 * true cuando el elemento entra al viewport (una sola vez, con IntersectionObserver).
 * Si el navegador no soporta IntersectionObserver, se considera visible desde el inicio.
 */
export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const supported = typeof IntersectionObserver !== "undefined";
  const [inView, setInView] = useState(!supported);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView || !supported) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, supported, threshold]);

  return { ref, inView };
}
