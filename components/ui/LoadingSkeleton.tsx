import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-cream border border-taraTaupe/20", className)} />;
}

/**
 * Mirrors ProductCard's real geometry — the rounded shell, the 4:5 image, two
 * title lines, a category line, and the price/bag row — so the grid does not
 * reflow when the products arrive. A skeleton that is the wrong shape is worse
 * than none: it moves the page twice instead of once.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-[24px] border border-taraTaupe/25 bg-taraWhite p-2 sm:rounded-[28px] sm:p-2.5">
      <Skeleton className="aspect-[3/4] w-full rounded-[18px] sm:rounded-[22px]" />
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3 sm:px-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-11/12 rounded" />
            <Skeleton className="mt-2 h-3.5 w-2/3 rounded" />
            <Skeleton className="mt-2.5 h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[16px]" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
