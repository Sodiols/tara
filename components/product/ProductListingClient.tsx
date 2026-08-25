"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Product } from "@/types";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { MobileFilterDrawer } from "./MobileFilterDrawer";
import { ProductGrid } from "./ProductGrid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import {
  CATALOGUE_SORTS,
  MAX_REVEALED_PAGES,
  SORT_LABELS,
  hasActiveFilters,
  paramsFromProductFilters,
  parseSort,
  type CatalogueSort,
  type ProductFilters,
} from "@/lib/catalogue-filters";

export interface ListingScopeProps {
  category?: string;
  collection?: string;
  isNew?: boolean;
  featured?: boolean;
  bestSeller?: boolean;
}

interface ProductListingClientProps {
  title: string;
  products: Product[];
  /** Products matching the filters across the whole catalogue, not this page. */
  total: number;
  page: number;
  hasMore: boolean;
  filters: ProductFilters;
  facets: {
    sizes: string[];
    colours: string[];
    fabrics: string[];
    collections: string[];
  };
  scope: ListingScopeProps;
}

/**
 * The catalogue listing.
 *
 * Two rules keep this correct at any catalogue size:
 *
 *   1. Filtering and sorting are the server's job. This component never filters
 *      the array it was handed — it writes the shopper's choice into the URL
 *      and lets the page re-render from a fresh database query. Filtering a
 *      page of 24 in the browser would only ever have searched those 24.
 *
 *   2. "Load More" fetches the next page from the database and appends it. The
 *      URL's `page` is bumped at the same time, without a navigation, so a
 *      refresh re-renders exactly what was on screen and the back button still
 *      leaves the listing.
 */
export function ProductListingClient({
  title,
  products,
  total,
  page,
  hasMore,
  filters,
  facets,
  scope,
}: ProductListingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Pages appended in the browser since the last server render.
  const [appended, setAppended] = useState<Product[]>([]);
  const [loadedPage, setLoadedPage] = useState(page);
  const [moreAvailable, setMoreAvailable] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Anything the server rendered this listing from. When it changes, the server
  // has re-queried and the appended pages belong to the previous result set.
  const serverKey = paramsFromProductFilters({ ...filters, page }).toString();
  const [renderedKey, setRenderedKey] = useState(serverKey);

  // Adjusted during render rather than in an effect: React applies this before
  // committing, so the stale pages are never painted. Doing it in an effect
  // would render the old products once, then immediately render again.
  if (renderedKey !== serverKey) {
    setRenderedKey(serverKey);
    setAppended([]);
    setLoadedPage(page);
    setMoreAvailable(hasMore);
    setLoadError("");
  }

  const visibleProducts = renderedKey === serverKey ? [...products, ...appended] : products;

  const applyFilters = (next: ProductFilters) => {
    // Any filter change starts again at page 1: keeping the old page number
    // would ask for products 49-72 of a result set that may only have 12.
    const params = paramsFromProductFilters({ ...next, page: 1 });
    startTransition(() => {
      router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  const loadMore = async () => {
    if (loadingMore || !moreAvailable) return;
    setLoadingMore(true);
    setLoadError("");

    const nextPage = loadedPage + 1;
    const params = paramsFromProductFilters({ ...filters, page: nextPage });
    if (scope.category) params.set("category", scope.category);
    if (scope.collection) params.set("collectionSlug", scope.collection);
    if (scope.featured) params.set("featured", "true");
    if (scope.bestSeller) params.set("bestSeller", "true");
    if (scope.isNew) params.set("new", "true");

    try {
      const response = await fetch(`/api/products/list?${params}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const payload = (await response.json()) as {
        products?: Product[];
        hasMore?: boolean;
      };
      const batch = payload.products ?? [];

      // Belt and braces against a duplicate: the database ordering is
      // deterministic, so this should never drop anything, but appending the
      // same product twice would break React's keys if it ever did.
      const seen = new Set(visibleProducts.map((product) => product.id));
      setAppended((current) => [
        ...current,
        ...batch.filter((product) => !seen.has(product.id)),
      ]);
      setLoadedPage(nextPage);
      setMoreAvailable(Boolean(payload.hasMore));

      // Updates the address bar without a navigation, so a refresh brings back
      // everything that is currently on screen rather than only the first page.
      const urlParams = paramsFromProductFilters({ ...filters, page: nextPage });
      window.history.replaceState(
        null,
        "",
        `${pathname}${urlParams.size ? `?${urlParams}` : ""}`,
      );
    } catch {
      setLoadError("More products could not be loaded. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const filterProps = {
    filters,
    onChange: applyFilters,
    availableSizes: facets.sizes,
    availableColours: facets.colours,
    availableFabrics: facets.fabrics,
    availableCollections: facets.collections,
    onClearAll: clearAll,
    pending: isPending,
  };

  const showingCount = visibleProducts.length;

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: title }]} />
      <h1 className="font-serif font-normal text-[32px] sm:text-4xl lg:text-[44px] leading-[1.1] text-ink mt-3 mb-2">
        {title}
      </h1>
      {/*
        The count is the size of the whole filtered result set, reported by the
        database — not the length of the array on this page. It used to be the
        latter, so a listing could claim 24 products and then render three.
      */}
      <p className="font-sans font-normal text-sm text-muted mb-8" aria-live="polite">
        {total === 0
          ? "No products found"
          : showingCount < total
            ? `Showing ${showingCount} of ${total} products`
            : `${total} ${total === 1 ? "product" : "products"} found`}
      </p>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterPanel {...filterProps} />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex h-11 items-center gap-2 rounded-control font-sans font-medium text-sm text-ink border border-border px-4"
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              {"Filters"}
              {hasActiveFilters(filters) && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-wine" aria-hidden="true" />
              )}
            </button>
            <div className="ml-auto">
              <label htmlFor="sort" className="sr-only">
                {"Sort By"}
              </label>
              <select
                id="sort"
                value={filters.sort ?? "newest"}
                onChange={(event) =>
                  applyFilters({ ...filters, sort: parseSort(event.target.value) })
                }
                className="h-11 rounded-control border border-border bg-white px-3 font-sans font-medium text-xs sm:text-sm text-ink focus:outline-none focus:border-wine"
              >
                {CATALOGUE_SORTS.map((option: CatalogueSort) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
            <ProductGrid products={visibleProducts} />
          </div>

          {loadError && (
            <p role="alert" className="mt-8 text-center text-sm text-wine">
              {loadError}
            </p>
          )}

          {moreAvailable && (
            <div className="flex justify-center mt-12 lg:mt-16">
              <Button variant="outline" onClick={loadMore} loading={loadingMore}>
                {"Load More"}
              </Button>
            </div>
          )}

          {/*
            Past the cumulative ceiling another request cannot return anything
            new, so the button is replaced by the thing that will actually help.
          */}
          {!moreAvailable && loadedPage >= MAX_REVEALED_PAGES && showingCount < total && (
            <p className="mt-12 text-center text-sm text-muted lg:mt-16">
              {`Showing the first ${showingCount} of ${total} products. Use the filters or the search to narrow this down.`}
            </p>
          )}
        </div>
      </div>

      <MobileFilterDrawer
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        {...filterProps}
      />
    </Container>
  );
}
