import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-wine text-taraIvory border border-wine hover:bg-taraBlack hover:border-taraBlack hover:text-white",
  secondary: "bg-white text-wine border border-wine hover:bg-wine hover:text-white",
  outline: "bg-transparent text-ink border border-border hover:border-wine hover:text-wine",
  ghost: "bg-transparent text-ink hover:bg-beige",
  destructive: "bg-transparent text-wine border border-wine/40 hover:bg-wine hover:text-white hover:border-wine",
};

// Fixed heights keep every button in a row visually identical regardless of
// label length or icon presence.
const sizeClasses: Record<Size, string> = {
  sm: "h-11 px-5",
  md: "h-12 px-7",
  lg: "h-[52px] px-8",
};

// "Disabled state: Soft Ivory background with muted TARA Black text" — overrides
// whichever variant is active so disabled buttons never render as one of the
// active brand colours.
const disabledClasses =
  "disabled:!bg-cream disabled:!text-muted disabled:!border-border disabled:cursor-not-allowed";

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", fullWidth, loading, disabled, className, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control tracking-wider uppercase font-sans font-semibold text-[13px] leading-4 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
          variantClasses[variant],
          sizeClasses[size],
          disabledClasses,
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

interface LinkButtonProps extends BaseProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ariaLabel,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control tracking-wide uppercase font-sans font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
    >
      {children}
    </Link>
  );
}
