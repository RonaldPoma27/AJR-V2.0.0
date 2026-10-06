import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const chips: { key: string | null; label: string; count: number }[] = [
    { key: null, label: t("adminCommon.all"), count: total },
    ...Object.keys(labels).map((key) => ({ key, label: labels[key], count: counts[key] ?? 0 })),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("adminCommon.filterByStatus")}>
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
                : "bg-surface text-fg-muted hover:border-brand hover:text-accent"
            )}
          >
            {chip.label} <span className={cn("font-semibold", !selected && "text-accent")}>{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
