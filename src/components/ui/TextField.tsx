import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 w-full rounded-xl border bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15 ${
          error ? 'border-danger-500' : 'border-neutral-300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
