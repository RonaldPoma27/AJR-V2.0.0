import { useId } from "react";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-1 w-full rounded-md border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function FieldShell({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

interface BaseProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
}

export function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  error,
  hint,
  maxLength,
  autoComplete,
  placeholder,
}: BaseProps & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-400")}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  required,
  error,
  hint,
  maxLength,
  minLength,
  rows = 5,
}: BaseProps & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxLength: number;
  /** Si se pasa, el contador avisa cuánto falta para llegar al mínimo. */
  minLength?: number;
  rows?: number;
}) {
  const id = useId();
  const length = value.trim().length;
  const counter =
    minLength && length < minLength
      ? `${length}/${maxLength} · faltan ${minLength - length} para el mínimo`
      : `${length}/${maxLength}`;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, error && "border-red-400")}
      />
      <p className="mt-1 text-right text-xs text-gray-400" aria-live="polite">
        {counter}
      </p>
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required,
  error,
  hint,
  placeholder = "Elegí una opción",
}: BaseProps & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, "bg-white", error && "border-red-400")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-gray-700">
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Campo señuelo anti-spam: invisible para personas (y lectores de pantalla), pero los bots
 * lo completan. Si llega con contenido, el backend descarta el envío en silencio.
 */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        No completar este campo
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={onChange}
        />
      </label>
    </div>
  );
}
