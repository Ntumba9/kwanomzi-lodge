import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-lg border border-mist-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-700/40 focus:border-lagoon-600 focus:outline-none focus:ring-1 focus:ring-lagoon-600";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, htmlFor, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-700/70">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ label, error, hint, id, className, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrapper label={label} htmlFor={fieldId ?? ""} error={error} hint={hint}>
      <input id={fieldId} className={cn(controlClasses, error && "border-red-400", className)} {...props} />
    </FieldWrapper>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({ label, error, hint, id, className, ...props }: TextAreaFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrapper label={label} htmlFor={fieldId ?? ""} error={error} hint={hint}>
      <textarea id={fieldId} className={cn(controlClasses, "min-h-24", error && "border-red-400", className)} {...props} />
    </FieldWrapper>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function SelectField({ label, error, hint, id, className, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrapper label={label} htmlFor={fieldId ?? ""} error={error} hint={hint}>
      <select id={fieldId} className={cn(controlClasses, error && "border-red-400", className)} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}
