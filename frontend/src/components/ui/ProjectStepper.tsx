import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PROJECT_STEPS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useInView } from "@/lib/useInView";

/**
 * Línea de progreso del proyecto (horizontal): Análisis → Diseño → Desarrollo → Revisión → Entregado.
 *
 * `currentStep` va de 1 a 5:
 *  - pasos anteriores: completados (color de éxito + check);
 *  - el actual: borde de marca y un pulso suave;
 *  - los siguientes: grises, adaptados al tema.
 * Con `currentStep` = 5 el proyecto está entregado y los cinco pasos figuran completados.
 */
export default function ProjectStepper({
  currentStep,
  className,
}: {
  currentStep: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const total = PROJECT_STEPS.length;
  const current = Math.min(Math.max(Math.round(currentStep) || 1, 1), total);
  const delivered = current === total;
  const { ref, inView } = useInView<HTMLOListElement>();

  return (
    <ol ref={ref} className={cn("flex", className)} aria-label={t("projectStepper.label")}>
      {PROJECT_STEPS.map((key, index) => {
        const step = index + 1;
        const done = step < current || delivered;
        const active = step === current && !delivered;
        // El tramo que llega a este paso se llena cuando el paso anterior ya está completo.
        const lineFilled = step <= current || delivered;
        const label = t(`projectStepper.steps.${key}`);
        return (
          <li
            key={key}
            aria-current={active ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
          >
            {index > 0 && (
              <span aria-hidden className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-line">
                <span
                  style={{ transitionDelay: `${index * 140}ms` }}
                  className={cn(
                    "absolute inset-y-0 right-0 w-full origin-right bg-emerald-500 transition-transform duration-500 ease-out motion-reduce:transition-none",
                    lineFilled && inView ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                done && "border-emerald-500 bg-emerald-500 text-white",
                active && "animate-step-pulse border-accent bg-surface text-accent motion-reduce:animate-none",
                !done && !active && "border-line bg-surface-2 text-fg-subtle"
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : step}
            </span>
            <span
              className={cn(
                "mt-2 w-full break-words px-0.5 text-[11px] leading-tight sm:text-sm",
                active ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle"
              )}
            >
              {label}
              <span className="sr-only">
                {done ? t("projectStepper.done") : active ? t("projectStepper.current") : t("projectStepper.pending")}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
