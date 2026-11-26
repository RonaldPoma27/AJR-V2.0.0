import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  accent: boolean;
}

interface MeshPoint {
  x: number;
  y: number;
  depth: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(value: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Fondo independiente del portfolio: grafito, polvo plateado y una malla
 * topográfica de datos muy discreta. La luz sigue el cursor con parallax suave;
 * unas pocas partículas adoptan el acento del proyecto activo, nunca el de AJR.
 */
export default function PortfolioAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = !document.hidden;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    let time = 0;
    let scrollY = window.scrollY;
    let smoothScrollY = scrollY;
    let meshColumns = 30;
    let meshRows = 10;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let particles: Particle[] = [];

    const createParticles = () => {
      const area = Math.max(1, width * height);
      const count = Math.max(48, Math.min(92, Math.round(area / 23000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.96,
        vx: (Math.random() - 0.5) * 0.11,
        vy: -0.025 - Math.random() * 0.11,
        radius: 0.55 + Math.random() * 1.05,
        alpha: 0.095 + Math.random() * 0.16,
        phase: index * 0.47 + Math.random() * Math.PI,
        accent: index % 7 === 0,
      }));
    };

    const readAccent = (): Rgb => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--portfolio-atmosphere-accent")
        .trim();
      return parseHexColor(value) ?? { r: 194, g: 200, b: 208 };
    };

    const resize = () => {
      stop();
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      meshColumns = width < 640 ? 18 : width < 1100 ? 25 : 31;
      meshRows = width < 640 ? 7 : 9;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
      draw(false);
      start();
    };

    const createMeshPoint = (column: number, row: number, animate: boolean): MeshPoint => {
      const u = column / (meshColumns - 1);
      const depth = row / (meshRows - 1);
      const motion = animate ? time : 0;
      const perspective = 0.32 + depth * 0.94;
      const parallaxX = pointer.x * (8 + depth * 10);
      const parallaxY = pointer.y * (5 + depth * 8);
      const x = width * 0.5 + parallaxX + (u - 0.5) * width * perspective;
      const contourA = Math.sin(u * Math.PI * 4.4 - motion * 0.34 + depth * 3.1);
      const contourB = Math.cos(u * Math.PI * 2.1 + depth * 5.2 - motion * 0.2);
      const amplitude = 2.5 + depth * 15;
      const scrollParallax = Math.min(46, smoothScrollY * 0.035);
      const y = height * 0.6 + depth * height * 0.52 + contourA * amplitude + contourB * amplitude * 0.24 + parallaxY - scrollParallax;
      return { x, y, depth };
    };

    const drawMesh = (animate: boolean) => {
      const points: MeshPoint[][] = [];
      for (let row = 0; row < meshRows; row += 1) {
        const line: MeshPoint[] = [];
        for (let column = 0; column < meshColumns; column += 1) {
          line.push(createMeshPoint(column, row, animate));
        }
        points.push(line);
      }

      context.lineWidth = 0.7;
      for (let row = 0; row < meshRows; row += 1) {
        const depth = row / (meshRows - 1);
        context.strokeStyle = `rgba(184, 191, 201, ${(0.022 + depth * 0.032).toFixed(3)})`;
        context.beginPath();
        points[row].forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }

      for (let column = 0; column < meshColumns; column += 1) {
        context.beginPath();
        points.forEach((row, rowIndex) => {
          const point = row[column];
          if (rowIndex === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.strokeStyle = "rgba(184, 191, 201, 0.031)";
        context.stroke();

        if (column % 4 === 0) {
          for (let row = 0; row < meshRows - 1; row += 1) {
            const from = points[row][column];
            const to = points[row + 1][Math.min(column + 1, meshColumns - 1)];
            context.strokeStyle = "rgba(198, 204, 213, 0.021)";
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.stroke();
          }
        }
      }

      for (let row = 1; row < meshRows; row += 2) {
        for (let column = 1; column < meshColumns; column += 4) {
          const point = points[row][column];
          context.globalAlpha = 0.028 + point.depth * 0.055;
          context.fillStyle = "#D6DAE0";
          context.beginPath();
          context.arc(point.x, point.y, 0.55 + point.depth * 0.38, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;

      const scanPhase = animate ? (Math.sin(time * 0.12) + 1) / 2 : 0.48;
      const scanY = height * (0.68 + scanPhase * 0.18) - Math.min(36, smoothScrollY * 0.025);
      const scan = context.createLinearGradient(0, scanY - 16, 0, scanY + 16);
      scan.addColorStop(0, "rgba(210, 215, 222, 0)");
      scan.addColorStop(0.5, "rgba(210, 215, 222, 0.03)");
      scan.addColorStop(1, "rgba(210, 215, 222, 0)");
      context.fillStyle = scan;
      context.fillRect(0, scanY - 16, width, 32);
    };

    const drawParticles = (animate: boolean) => {
      const accent = readAccent();
      const projected: Array<{ x: number; y: number }> = [];
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (animate) {
          particle.x += particle.vx + pointer.x * 0.012;
          particle.y += particle.vy + pointer.y * 0.009;
          if (particle.y < -10) particle.y = height + 10;
          if (particle.x < -10) particle.x = width + 10;
          if (particle.x > width + 10) particle.x = -10;
        }

        const breathing = animate ? 0.86 + Math.sin(time * 0.8 + particle.phase) * 0.14 : 0.92;
        const alpha = particle.alpha * breathing;
        if (particle.accent) {
          context.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${(alpha * 0.34).toFixed(3)})`;
        } else {
          context.fillStyle = `rgba(210, 215, 222, ${alpha.toFixed(3)})`;
        }
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        if (index < 32) projected.push({ x: particle.x, y: particle.y });
      }

      // Only a small local neighborhood is linked; this avoids a dense starfield.
      context.lineWidth = 0.55;
      for (let first = 0; first < projected.length; first += 1) {
        for (let second = first + 1; second < projected.length; second += 1) {
          const a = projected[first];
          const b = projected[second];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSquared = dx * dx + dy * dy;
          const limit = 138 * 138;
          if (distanceSquared < limit) {
            const opacity = (1 - distanceSquared / limit) * 0.038;
            context.strokeStyle = `rgba(190, 197, 207, ${opacity.toFixed(3)})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }
    };

    const draw = (animate: boolean) => {
      context.clearRect(0, 0, width, height);
      if (animate) {
        time += 0.008;
        pointer.x = lerp(pointer.x, pointer.targetX, 0.035);
        pointer.y = lerp(pointer.y, pointer.targetY, 0.035);
        smoothScrollY = lerp(smoothScrollY, scrollY, 0.035);
      } else {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        smoothScrollY = scrollY;
      }

      const glowX = width * (0.5 + pointer.x * 0.018);
      const glowY = height * (0.42 + pointer.y * 0.016) - Math.min(24, smoothScrollY * 0.018);
      const glow = context.createRadialGradient(glowX, glowY, 8, glowX, glowY, Math.max(width, height) * 0.48);
      glow.addColorStop(0, "rgba(205, 211, 220, 0.065)");
      glow.addColorStop(0.42, "rgba(145, 153, 166, 0.028)");
      glow.addColorStop(1, "rgba(15, 16, 20, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      drawMesh(animate);
      drawParticles(animate);
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${pointer.x * 18}px, ${pointer.y * 12 - Math.min(14, smoothScrollY * 0.01)}px, 0)`;
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

    const onPointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      pointer.targetY = (event.clientY / Math.max(1, height) - 0.5) * 2;
      if (reducedMotion) draw(false);
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      if (reducedMotion) draw(false);
    };

    resize();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div className="ajr-portfolio-atmosphere" aria-hidden="true">
      <div ref={glowRef} className="ajr-portfolio-atmosphere-glow" />
      <div className="ajr-portfolio-atmosphere-grid" />
      <canvas ref={canvasRef} className="ajr-portfolio-atmosphere-canvas" />
      <div className="ajr-portfolio-atmosphere-vignette" />
    </div>
  );
}
