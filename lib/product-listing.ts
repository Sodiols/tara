import {
  emptyFilterState,
  type FilterState,
  type SortOption,
} from "@/lib/product-filter-types";
import { productFiltersFromParams } from "@/lib/supabase/queries/products";

export type ListingSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function parseListingParams(searchParams: ListingSearchParams) {
  const filters = productFiltersFromParams(await searchParams);
  const priceRanges: [number, number][] =
    filters.minPrice != null || filters.maxPrice != null
      ? [[filters.minPrice ?? 0, filters.maxPrice ?? 1000000]]
      : [];
  const initialFilters: FilterState = {
    ...emptyFilterState,
    priceRanges,
    sizes: filters.sizes ?? [],
    colours: filters.colours ?? [],
    fabrics: filters.fabric ? [filters.fabric] : [],
    inStockOnly: Boolean(filters.inStock),
    onSale: Boolean(filters.onSale),
    newIn: Boolean(filters.isNew),
  };
  const initialSort: SortOption =
    filters.sort === "price-low"
      ? "priceLow"
      : filters.sort === "price-high"
        ? "priceHigh"
        : filters.sort === "popular"
          ? "popular"
          : "newest";
  return { filters, initialFilters, initialSort };
}
