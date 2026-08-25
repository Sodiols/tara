import { Container } from "@/components/layout/Container";
import { ProductGridSkeleton } from "@/components/ui/LoadingSkeleton";

/**
 * Shown while a listing's database query runs.
 *
 * Every catalogue route is dynamic — the filters come from the URL and the
 * results come from a live query — so the alternative is a blank screen for the
 * duration of the round trip. The grid, the sidebar column and the heading are
 * laid out at their real sizes so the page does not jump when the products
 * arrive, which is what would otherwise show up as cumulative layout shift.
 */
export function ProductListingSkeleton() {
  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <div className="h-4 w-40 animate-pulse rounded bg-cream" />
      <div className="mt-4 h-9 w-72 animate-pulse rounded bg-cream sm:h-11" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-cream" />

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-14">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 lg:flex" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <div className="h-3 w-24 animate-pulse rounded bg-cream" />
              <div className="h-3 w-full animate-pulse rounded bg-cream" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-cream" />
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </Container>
  );
}
