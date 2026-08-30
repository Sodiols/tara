import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  previousPrice?: number;
  size?: "sm" | "card" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-sm",
  /** The product card: large enough to read at a glance in a four-across grid. */
  card: "text-[17px] sm:text-[18px]",
  md: "text-base",
  lg: "text-2xl",
};

export function PriceDisplay({ price, previousPrice, size = "sm" }: PriceDisplayProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={cn("font-sans font-semibold text-ink", sizeClasses[size])}>{formatPrice(price)}</span>
      {previousPrice && previousPrice > price && (
        <span
          className={cn(
            "font-sans font-normal text-muted line-through",
            size === "lg" ? "text-base" : size === "card" ? "text-[13px]" : "text-xs"
          )}
        >
          {formatPrice(previousPrice)}
        </span>
      )}
    </div>
  );
}
