import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error wiring, so every form reads the same. */
export function Field({ label, error, hint, required, children, className }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className={`ops-field ${error ? "ops-field--error" : ""} ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="ops-field__req" aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": note ? noteId : undefined,
      })}
      {note && (
        <p id={noteId} className={error ? "ops-field__error" : "ops-field__hint"}>
          {note}
        </p>
      )}
    </div>
  );
}

type Shared = { label: string; error?: string; hint?: string; className?: string };

export function TextField({
  label,
  error,
  hint,
  className,
  required,
  ...props
}: Shared & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => <input {...a11y} {...props} required={required} />}
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  className,
  required,
  ...props
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => <textarea rows={3} {...a11y} {...props} required={required} />}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  error,
  hint,
  className,
  required,
  options,
  placeholder,
  ...props
}: Shared &
  SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => (
        <select {...a11y} {...props} required={required}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckField({
  label,
  ...props
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="ops-check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
