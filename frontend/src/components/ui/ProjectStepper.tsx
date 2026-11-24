import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const STEPS = ["analysis", "design", "development", "review", "delivered"] as const;

/** Stepper de cinco etapas para paneles de proyecto; currentStep va de 1 a 5. */
export default function ProjectStepper({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation();
  const current = Math.max(1, Math.min(5, Math.round(currentStep)));
  return (
    <ol className="flex w-full" aria-label={t("projectStepper.label")}>
      {STEPS.map((step, index) => {
        const number = index + 1;
        const complete = number < current;
        const active = number === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {index > 0 && <span aria-hidden className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", number <= current ? "bg-emerald-500" : "bg-line")} />}
            <span className={cn(
              "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
              complete && "border-emerald-500 bg-emerald-500 text-white",
              active && "border-accent bg-surface text-accent ring-4 ring-accent/20 motion-safe:animate-pulse",
              !complete && !active && "border-line bg-surface text-fg-subtle",
            )}>
              {complete ? <Check className="h-4 w-4" aria-hidden /> : number}
            </span>
            <span className={cn("mt-2 px-1 text-[10px] leading-tight sm:text-xs", active ? "font-semibold text-fg" : complete ? "text-emerald-600 dark:text-emerald-400" : "text-fg-subtle")}>{t(`projectStepper.steps.${step}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
