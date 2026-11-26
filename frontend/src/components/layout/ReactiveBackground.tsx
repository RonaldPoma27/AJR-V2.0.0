import { useEffect, useRef } from "react";

interface ReactiveParticle {
  phase1X: number;
  phase1Y: number;
  phase2X: number;
  phase2Y: number;
  phase3X: number;
  phase3Y: number;
  phase4X: number;
  phase4Y: number;
  drift: number;
  size: number;
  alpha: number;
  color: string;
  phase: number;
}

const PALETTE = [
  "34, 211, 238",  // cyan
  "59, 130, 246",  // electric blue
  "129, 140, 248", // soft indigo
  "186, 230, 253", // ice highlight
];

function smoothstep(start: number, end: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Fondo global reactivo Dark Tech Premium.
 * Cuatro composiciones de datos se transforman suavemente con el scroll:
 * nube de telemetría, cintas neuronales, matriz isométrica y malla de señales.
 * Reacciona al cursor con parallax leve; no dibuja espirales ni anillos.
 */
export default function ReactiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let time = 0;
    let visible = !document.hidden;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scrollProgress = 0;
    let smoothScroll = 0;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let particles: ReactiveParticle[] = [];

    const createParticles = () => {
      const count = width < 680 ? 250 : 430;
      const columns = 22;
      const rows = Math.ceil(count / columns);
      particles = Array.from({ length: count }, (_, index) => {
        const random = Math.random;
        const normal = () => (random() + random() + random() + random() - 2) * 0.42;
        const clustered = index < count * 0.34;
        const fieldX = (random() - 0.5) * 2.45;
        const fieldY = (random() - 0.5) * 1.85;
        const phase1X = clustered ? normal() * 0.92 : fieldX;
        const phase1Y = clustered ? normal() * 0.82 : fieldY;

        const ribbonU = ((index * 0.61803398875) % 1);
        const ribbonLane = (index % 9) - 4;
        const phase2X = (ribbonU - 0.5) * 2.2;
        const phase2Y = ribbonLane * 0.105 + Math.sin(ribbonU * Math.PI * 5.2 + ribbonLane * 0.62) * 0.12;

        const gridColumn = (index % columns) / (columns - 1) - 0.5;
        const gridRow = Math.floor(index / columns) / Math.max(1, rows - 1) - 0.5;
        const phase3X = gridColumn * 1.55 + gridRow * 0.38;
        const phase3Y = gridRow * 1.25 - gridColumn * 0.34;

        const phase4X = (ribbonU - 0.5) * 2.35;
        const phase4Y = Math.sin(ribbonU * Math.PI * 4.3 + ribbonLane * 0.7) * 0.17 + ribbonLane * 0.095;

        const paletteIndex = index % 12;
        const color = paletteIndex === 0 || paletteIndex === 1
          ? PALETTE[1]
          : paletteIndex === 2
            ? PALETTE[2]
            : paletteIndex === 3
              ? PALETTE[3]
              : PALETTE[0];

        return {
          phase1X,
          phase1Y,
          phase2X,
          phase2Y,
          phase3X,
          phase3Y,
          phase4X,
          phase4Y,
          drift: 0.006 + random() * 0.012,
          size: 0.65 + random() * 1.15,
          alpha: 0.075 + random() * 0.13,
          color,
          phase: index * 0.071 + random() * Math.PI * 2,
        };
      });
    };

    const updateScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      if (reducedMotion) draw(false);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(1, height) - 0.5) * 2;
      if (reducedMotion) draw(false);
    };

    const resize = () => {
      stop();
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
      draw(false);
      start();
    };

    const draw = (animate: boolean) => {
      context.clearRect(0, 0, width, height);
      if (animate) {
        time += 0.008;
        smoothScroll = lerp(smoothScroll, scrollProgress, 0.035);
        pointer.x = lerp(pointer.x, pointer.targetX, 0.035);
        pointer.y = lerp(pointer.y, pointer.targetY, 0.035);
      } else {
        smoothScroll = scrollProgress;
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
      }

      const centerX = width * 0.53 + pointer.x * 25;
      const centerY = height * 0.48 + pointer.y * 18 - smoothScroll * 14;
      const halo = context.createRadialGradient(centerX, centerY, 8, centerX, centerY, Math.max(width, height) * 0.58);
      halo.addColorStop(0, "rgba(34, 211, 238, 0.075)");
      halo.addColorStop(0.42, "rgba(59, 130, 246, 0.035)");
      halo.addColorStop(0.72, "rgba(139, 92, 246, 0.018)");
      halo.addColorStop(1, "rgba(7, 13, 27, 0)");
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      const phase12 = smoothstep(0.16, 0.34, smoothScroll);
      const phase23 = smoothstep(0.43, 0.61, smoothScroll);
      const phase34 = smoothstep(0.70, 0.88, smoothScroll);

      const projected: Array<{ x: number; y: number; alpha: number }> = [];
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const wobble = animate ? Math.sin(time * 1.25 + particle.phase) * particle.drift : 0;
        const p1x = particle.phase1X + wobble;
        const p1y = particle.phase1Y + Math.cos(time + particle.phase) * particle.drift;
        const p2x = particle.phase2X;
        const p2y = particle.phase2Y + Math.sin(time * 1.3 + particle.phase) * 0.018;
        const p3x = particle.phase3X;
        const p3y = particle.phase3Y + Math.sin(particle.phase3X * 3.5 + time) * 0.025;
        const p4x = particle.phase4X;
        const p4y = particle.phase4Y + Math.sin(particle.phase4X * 3 + time * 1.5 + particle.phase) * 0.035;

        let nx = lerp(p1x, p2x, phase12);
        let ny = lerp(p1y, p2y, phase12);
        nx = lerp(nx, p3x, phase23);
        ny = lerp(ny, p3y, phase23);
        nx = lerp(nx, p4x, phase34);
        ny = lerp(ny, p4y, phase34);
        const parallax = 1 + pointer.x * 0.018;
        nx *= parallax;
        ny += pointer.y * 0.012;

        const depth = 0.78 + (Math.sin(particle.phase) + 1) * 0.11;
        const x = centerX + nx * width * 0.43 * depth;
        const y = centerY + ny * height * 0.43 * depth;
        if (x < -24 || x > width + 24 || y < -24 || y > height + 24) continue;

        const alpha = particle.alpha * Math.min(1, Math.max(0.28, depth));
        context.fillStyle = `rgba(${particle.color}, ${alpha.toFixed(3)})`;
        context.beginPath();
        context.arc(x, y, Math.max(0.55, particle.size * depth), 0, Math.PI * 2);
        context.fill();
        if (index < 64) projected.push({ x, y, alpha });
      }

      // Sparse links turn the central nodes into a restrained telemetry network.
      context.lineWidth = 0.65;
      for (let first = 0; first < projected.length; first += 1) {
        for (let second = first + 1; second < projected.length; second += 1) {
          const a = projected[first];
          const b = projected[second];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSquared = dx * dx + dy * dy;
          const radiusSquared = 118 * 118;
          if (distanceSquared < radiusSquared) {
            const opacity = (1 - distanceSquared / radiusSquared) * 0.11;
            context.strokeStyle = `rgba(67, 190, 224, ${opacity.toFixed(3)})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }
    };

    const tick = () => {
      frame = 0;
      if (!visible || reducedMotion) return;
      draw(true);
      frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && visible && !reducedMotion) frame = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const onVisibilityChange = () => {
      visible = !document.hidden;
      if (visible) start();
      else stop();
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      stop();
      draw(false);
      start();
    };

    resize();
    updateScroll();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div className="ajr-global-atmosphere" aria-hidden="true">
      <div className="ajr-global-atmosphere-glow" />
      <canvas ref={canvasRef} className="ajr-global-atmosphere-canvas" />
      <div className="ajr-global-atmosphere-vignette" />
    </div>
  );
}
