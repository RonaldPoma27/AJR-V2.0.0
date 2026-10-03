import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password";
import { cn } from "@/lib/utils";

/** Checklist en vivo de los requisitos de una contraseña nueva. */
export default function PasswordChecklist({ value, id }: { value: string; id?: string }) {
  return (
    <ul id={id} aria-label="Requisitos de la contraseña" className="mt-2 space-y-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.id} className={cn("flex items-center gap-1.5", ok ? "text-green-700 dark:text-green-400" : "text-fg-subtle")}>
            {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
            <span>
              {rule.label}
              <span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
