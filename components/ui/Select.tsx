import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn, slugify } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className, children, ...props }, ref) => {
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
          <select
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            // Matches Input/Textarea: the error text is associated with the
            // control rather than merely sitting next to it, so a screen reader
            // reads the reason when focus lands on the field.
            aria-describedby={inputId && error ? `${inputId}-error` : undefined}
            className={cn(
              "h-[52px] w-full appearance-none rounded-control border border-border bg-white pl-4 pr-11 font-sans font-normal text-sm text-ink focus:outline-none focus:border-wine transition-colors",
              "disabled:bg-beige/60 disabled:text-muted disabled:cursor-not-allowed",
              error && "border-wine focus:border-wine",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
        {error && (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            role="alert"
            className="text-xs text-wine"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
