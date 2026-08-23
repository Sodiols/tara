import { useMemo, useState } from "react";
import type { Product } from "@/types";
import {
  emptyFilterState,
  type FilterState,
  type SortOption,
} from "@/lib/product-filter-types";

export { emptyFilterState };
export type { FilterState, SortOption };

export function useProductFilters(products: Product[], initialFilters: FilterState = emptyFilterState, initialSort: SortOption = "newest") {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sort, setSort] = useState<SortOption>(initialSort);

  const availableSizes = useMemo(
    () => Array.from(new Set(products.flatMap((p) => p.sizes))).filter((s) => s !== "One Size" && s !== "Unstitched"),
    [products]
  );
  // Blanks are dropped throughout: a product that belongs to no collection is
  // stored with `collection: ""`, and an empty value would otherwise render as
  // a checkbox with no label that filters everything away when ticked.
  const availableColours = useMemo(
    () =>
      Array.from(
        new Set(products.flatMap((p) => p.colours.map((c) => c.name.trim())))
      ).filter(Boolean),
    [products]
  );
  const availableFabrics = useMemo(
    () => Array.from(new Set(products.map((p) => p.fabric.trim()))).filter(Boolean),
    [products]
  );
  const availableCollections = useMemo(
    () => Array.from(new Set(products.map((p) => p.collection.trim()))).filter(Boolean),
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      if (filters.newIn && !p.isNew) return false;
      if (filters.onSale && !p.isSale) return false;
      if (filters.inStockOnly && p.stock === 0) return false;
      if (filters.priceRanges.length > 0) {
        const inRange = filters.priceRanges.some(([min, max]) => p.price >= min && p.price <= max);
        if (!inRange) return false;
      }
      if (filters.sizes.length > 0 && !p.sizes.some((s) => filters.sizes.includes(s))) return false;
      if (filters.colours.length > 0 && !p.colours.some((c) => filters.colours.includes(c.name))) return false;
      if (filters.fabrics.length > 0 && !filters.fabrics.includes(p.fabric)) return false;
      if (filters.collections.length > 0 && !filters.collections.includes(p.collection)) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "priceLow":
          return a.price - b.price;
        case "priceHigh":
          return b.price - a.price;
        case "popular":
          return b.rating * b.reviewCount - a.rating * a.reviewCount;
        case "newest":
        default:
          return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      }
    });

    return result;
  }, [products, filters, sort]);

  const clearAll = () => setFilters(emptyFilterState);

  return {
    filters,
    setFilters,
    sort,
    setSort,
    filteredProducts,
    availableSizes,
    availableColours,
    availableFabrics,
    availableCollections,
    clearAll,
  };
}
