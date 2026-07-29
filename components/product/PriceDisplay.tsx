import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: number;
  previousPrice?: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-sm",
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
            size === "lg" ? "text-base" : "text-xs"
          )}
        >
          {formatPrice(previousPrice)}
        </span>
      )}
    </div>
  );
}
