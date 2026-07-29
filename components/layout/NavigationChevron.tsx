import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationChevronProps {
  open: boolean;
  size?: number;
  className?: string;
}

export function NavigationChevron({ open, size = 14, className }: NavigationChevronProps) {
  return (
    <ChevronDown
      size={size}
      aria-hidden="true"
      className={cn("transition-transform duration-200 ease-out", open && "-rotate-180", className)}
    />
  );
}
