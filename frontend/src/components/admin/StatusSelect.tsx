export default function StatusSelect<T extends string>({
  value,
  labels,
  onChange,
  disabled,
  label,
}: {
  value: T;
  labels: Record<T, string>;
  onChange: (status: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none disabled:opacity-50"
    >
      {(Object.keys(labels) as T[]).map((key) => (
        <option key={key} value={key}>
          {labels[key]}
        </option>
      ))}
    </select>
  );
}
