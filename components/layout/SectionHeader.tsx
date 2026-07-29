import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  heading: string;
  description?: string;
  action?: ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  heading,
  description,
  action,
  align = "center",
  className,
}: SectionHeaderProps) {
  const isCentered = align === "center";

  return (
    <div
      className={cn(
        "mb-10 lg:mb-14 flex flex-col gap-3",
        isCentered && "items-center text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="font-sans font-semibold text-[11px] sm:text-xs leading-[15px] sm:leading-4 tracking-[0.08em] uppercase text-wine">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif font-normal text-[32px] sm:text-4xl lg:text-[44px] leading-[1.1] text-ink">
        {heading}
      </h2>
      {description && (
        <p
          className={cn(
            "font-sans font-normal text-base leading-relaxed text-muted",
            isCentered ? "max-w-xl" : "max-w-lg"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
