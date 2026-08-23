import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { Check } from "lucide-react";
import { cn, slugify } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Guidance shown before anything goes wrong — e.g. a password rule. */
  hint?: string;
  success?: boolean;
}

/**
 * `aria-describedby` names the hint and the error together, so a screen reader
 * reads the rule as well as the failure. The error also carries `role="alert"`:
 * it appears after submit, and without a live region it would be announced only
 * if the user happened to navigate back onto the field.
 */
function describedBy(inputId: string | undefined, hint?: string, error?: string) {
  if (!inputId) return undefined;
  const ids = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, success, id, className, ...props }, ref) => {
    const inputId = id ?? props.name ?? (label ? slugify(label) : undefined);
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-sans font-medium text-sm text-ink">
            {label}
            {props.required && <span className="text-wine"> *</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={describedBy(inputId, hint, error)}
            className={cn(
              "h-[52px] w-full rounded-control border border-border bg-white px-4 font-sans font-normal text-sm text-ink placeholder:text-muted focus:outline-none focus:border-wine transition-colors",
              "disabled:bg-beige/60 disabled:text-muted disabled:cursor-not-allowed",
              error && "border-wine focus:border-wine",
              success && "border-wine pr-11",
              className
            )}
            {...props}
          />
          {success && !error && (
            <Check size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-wine" aria-hidden="true" />
          )}
        </div>
        {hint && !error && (
          <p id={inputId ? `${inputId}-hint` : undefined} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="text-xs text-wine">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? props.name ?? (label ? slugify(label) : undefined);
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-sans font-medium text-sm text-ink">
            {label}
            {props.required && <span className="text-wine"> *</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy(inputId, hint, error)}
          className={cn(
            "w-full rounded-control border border-border bg-white px-4 py-3.5 font-sans font-normal text-sm text-ink placeholder:text-muted focus:outline-none focus:border-wine transition-colors",
            "disabled:bg-beige/60 disabled:text-muted disabled:cursor-not-allowed",
            error && "border-wine focus:border-wine",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={inputId ? `${inputId}-hint` : undefined} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="text-xs text-wine">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
