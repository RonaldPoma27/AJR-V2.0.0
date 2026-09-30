import { cn } from "@/lib/utils";

/** Contador por estado. Cada chip también filtra la lista al hacer click. */
export default function StatusChips({
  counts,
  labels,
  active,
  onSelect,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
  active: string | null;
  onSelect: (status: string | null) => void;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const chips: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "Todos", count: total },
    ...Object.keys(labels).map((key) => ({ key, label: labels[key], count: counts[key] ?? 0 })),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      {chips.map((chip) => {
        const selected = chip.key === active;
        return (
          <button
            key={chip.key ?? "todos"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(chip.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              selected
                ? "border-brand bg-brand text-white"
                : "bg-white text-gray-700 hover:border-brand hover:text-brand"
            )}
          >
            {chip.label} <span className={cn("font-semibold", !selected && "text-brand")}>{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
