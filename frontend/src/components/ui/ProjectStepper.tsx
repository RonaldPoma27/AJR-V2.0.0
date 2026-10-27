import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PROJECT_STEPS } from "@/lib/projectSteps";
import { useInView } from "@/lib/useInView";
import { cn } from "@/lib/utils";

/**
 * Línea de progreso horizontal del proyecto: Análisis → Diseño → Desarrollo → Revisión → Entregado.
 * `currentStep` va de 1 a 5. Completados: verde con check · actual: borde azul y halo que pulsa ·
 * pendientes: gris. Si el actual es el último, el proyecto está entregado y todos quedan completados.
 */
export default function ProjectStepper({ currentStep, className }: { currentStep: number; className?: string }) {
  const { t } = useTranslation();
  const { ref, inView } = useInView<HTMLOListElement>();
  const total = PROJECT_STEPS.length;
  const current = Math.min(Math.max(Math.round(currentStep), 1), total);
  const delivered = current === total;

  return (
    <ol ref={ref} className={cn("flex", className)} aria-label={t("projectStepper.label")}>
      {PROJECT_STEPS.map((step, index) => {
        const number = index + 1;
        const done = number < current || delivered;
        const active = number === current && !delivered;
        const reached = done || active;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center text-center"
          >
            {index > 0 && (
              <span aria-hidden className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-line">
                <span
                  style={{ transitionDelay: `${index * 120}ms` }}
                  className={cn(
                    "absolute inset-y-0 right-0 w-full origin-left bg-green-600 transition-transform duration-500 ease-out motion-reduce:transition-none dark:bg-green-500",
                    done && inView ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </span>
            )}
            <span className="relative z-10 flex h-8 w-8 items-center justify-center">
              {active && (
                <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-brand/25 ring-4 ring-brand/20 motion-reduce:animate-none" />
              )}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                  done && "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500",
                  active && "border-brand bg-surface text-accent",
                  !reached && "border-line bg-surface text-fg-subtle"
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : number}
              </span>
            </span>
            <span
              className={cn(
                "mt-2 px-1 text-xs sm:text-sm",
                active ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle"
              )}
            >
              {t(`projectStepper.steps.${step}`)}
              <span className="sr-only">
                {" "}
                {done ? t("projectStepper.done") : active ? t("projectStepper.current") : t("projectStepper.pending")}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
