import { Check } from "lucide-react";
import { ORDER_FLOW, type OrderStatus } from "@/api/orders";
import { ORDER_STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Progreso de un pedido: NUEVO → EN REVISIÓN → CONTACTADO → FINALIZADO.
 * `descartado` no es un paso del camino: se muestra el recorrido apagado y un aviso.
 */
export default function OrderStepper({ status }: { status: OrderStatus }) {
  const discarded = status === "descartado";
  const current = ORDER_FLOW.indexOf(status);
  const finished = status === "finalizado";

  return (
    <div>
      <ol className="flex" aria-label="Progreso del pedido">
        {ORDER_FLOW.map((step, index) => {
          const done = !discarded && (index < current || finished);
          const active = !discarded && index === current && !finished;
          const reached = done || active;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2",
                    reached ? "bg-brand" : "bg-line"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done && "border-brand bg-brand text-white",
                  active && "border-brand bg-surface text-accent ring-4 ring-brand/20",
                  !reached && "border-line bg-surface text-fg-subtle"
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "mt-2 px-1 text-xs sm:text-sm",
                  active ? "font-semibold text-fg" : reached ? "text-fg-muted" : "text-fg-subtle"
                )}
              >
                {ORDER_STATUS_LABELS[step]}
                <span className="sr-only">{done ? " (completado)" : active ? " (paso actual)" : " (pendiente)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {discarded && (
        <p role="status" className="mt-4 rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-700 dark:bg-gray-500/25 dark:text-gray-300">
          Este pedido fue descartado. Si querés retomarlo, escribinos desde Soporte.
        </p>
      )}
    </div>
  );
}
