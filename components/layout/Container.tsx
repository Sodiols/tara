import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * Shared page-content container: 1440px max width with the site's
 * standard responsive horizontal padding (20 / 32 / 48 / 64px).
 */
export function Container({ children, className, as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={cn("max-w-container mx-auto px-5 md:px-8 lg:px-12 xl:px-16", className)}>
      {children}
    </Tag>
  );
}
