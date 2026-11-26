import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
}

interface MeshPoint {
  x: number;
  y: number;
  depth: number;
}

/**
 * Fondo exclusivo de /portfolio y sus subrutas.
 * Malla topográfica/isométrica de datos + polvo de partículas en escala de grises.
 * No usa el acento del proyecto ni los colores de marca de AJR Data.
 * Se pausa fuera de la pestaña y respeta prefers-reduced-motion.
 */
export default function PortfolioAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let particles: Particle[] = [];
    let visible = !document.hidden;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    let time = 0;
    let meshColumns = 30;
    let meshRows = 10;

    const createParticles = () => {
      const area = Math.max(1, width * height);
      const count = Math.max(28, Math.min(72, Math.round(area / 26000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.92,
        vx: (Math.random() - 0.5) * 0.075,
        vy: (Math.random() - 0.5) * 0.055,
        radius: 0.45 + Math.random() * 0.85,
        alpha: 0.055 + Math.random() * 0.105,
        phase: index * 0.47 + Math.random() * Math.PI,
      }));
    };

    const resize = () => {
      stop();
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      meshColumns = width < 640 ? 21 : width < 1100 ? 26 : 34;
      meshRows = width < 640 ? 8 : 11;
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
      const timeOffset = animate ? time : 0;
      // The plane recedes towards a quiet horizon and widens towards the viewer.
      const perspective = 0.34 + depth * 0.92;
      const x = width * 0.5 + (u - 0.5) * width * perspective;
      const contourA = Math.sin(u * Math.PI * 5.2 - timeOffset * 0.38 + depth * 3.8);
      const contourB = Math.cos(u * Math.PI * 2.4 + depth * 5.6 - timeOffset * 0.24);
      const amplitude = 3.5 + depth * 20;
      const y = height * 0.57 + depth * height * 0.59 + contourA * amplitude + contourB * amplitude * 0.28;
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
      // Horizontal contour paths.
      for (let row = 0; row < meshRows; row += 1) {
        const depth = row / (meshRows - 1);
        context.strokeStyle = `rgba(184, 191, 201, ${(0.025 + depth * 0.035).toFixed(3)})`;
        context.beginPath();
        points[row].forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }

      // Perspective lines and sparse diagonal links create a technical data lattice.
      for (let column = 0; column < meshColumns; column += 1) {
        context.beginPath();
        points.forEach((row, rowIndex) => {
          const point = row[column];
          if (rowIndex === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.strokeStyle = "rgba(184, 191, 201, 0.035)";
        context.stroke();

        if (column % 3 === 0) {
          for (let row = 0; row < meshRows - 1; row += 1) {
            const from = points[row][column];
            const to = points[row + 1][Math.min(column + 1, meshColumns - 1)];
            context.strokeStyle = "rgba(198, 204, 213, 0.025)";
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.stroke();
          }
        }
      }

      // Small neutral signal nodes; deliberately sparse to keep the projects in focus.
      for (let row = 1; row < meshRows; row += 2) {
        for (let column = 1; column < meshColumns; column += 3) {
          const point = points[row][column];
          context.globalAlpha = 0.035 + point.depth * 0.065;
          context.fillStyle = "#D6DAE0";
          context.beginPath();
          context.arc(point.x, point.y, 0.55 + point.depth * 0.45, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;

      // A very soft scan line travels through the lower plane; it never uses brand colors.
      const scanPhase = animate ? (Math.sin(time * 0.13) + 1) / 2 : 0.48;
      const scanY = height * (0.66 + scanPhase * 0.21);
      const scan = context.createLinearGradient(0, scanY - 18, 0, scanY + 18);
      scan.addColorStop(0, "rgba(210, 215, 222, 0)");
      scan.addColorStop(0.5, "rgba(210, 215, 222, 0.035)");
      scan.addColorStop(1, "rgba(210, 215, 222, 0)");
      context.fillStyle = scan;
      context.fillRect(0, scanY - 18, width, 36);
    };

    const drawParticles = (animate: boolean) => {
      for (const particle of particles) {
        if (animate) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -8) particle.x = width + 8;
          if (particle.x > width + 8) particle.x = -8;
          if (particle.y < -8) particle.y = height + 8;
          if (particle.y > height + 8) particle.y = -8;
        }
      }

      // Connections are formed only at short range, like a quiet telemetry field.
      context.lineWidth = 0.55;
      for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
        const first = particles[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
          const second = particles[secondIndex];
          const dx = first.x - second.x;
          const dy = first.y - second.y;
          const distanceSquared = dx * dx + dy * dy;
          const limit = 145 * 145;
          if (distanceSquared < limit) {
            const opacity = (1 - distanceSquared / limit) * 0.045;
            context.strokeStyle = `rgba(190, 197, 207, ${opacity.toFixed(3)})`;
            context.beginPath();
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }

      for (const particle of particles) {
        const breathing = animate ? 0.82 + Math.sin(time + particle.phase) * 0.18 : 0.9;
        context.globalAlpha = particle.alpha * breathing;
        context.fillStyle = "#D5D9DF";
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const draw = (animate: boolean) => {
      context.clearRect(0, 0, width, height);
      if (animate) time += 0.009;
      drawMesh(animate);
      drawParticles(animate);
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
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", resize, { passive: true });
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", resize);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div className="ajr-portfolio-atmosphere" aria-hidden="true">
      <div className="ajr-portfolio-atmosphere-glow" />
      <div className="ajr-portfolio-atmosphere-grid" />
      <canvas ref={canvasRef} className="ajr-portfolio-atmosphere-canvas" />
      <div className="ajr-portfolio-atmosphere-vignette" />
    </div>
  );
}
