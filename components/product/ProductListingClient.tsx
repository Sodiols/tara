"use client";

import { useState, type SetStateAction } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Product, LocalizedText } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useProductFilters } from "@/hooks/useProductFilters";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { MobileFilterDrawer } from "./MobileFilterDrawer";
import { ProductGrid } from "./ProductGrid";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import type { FilterState, SortOption } from "@/lib/product-filter-types";

const PAGE_SIZE = 8;

interface ProductListingClientProps {
  titleKey?: string;
  titleText?: LocalizedText;
  products: Product[];
  initialFilters?: FilterState;
  initialSort?: SortOption;
}

export function ProductListingClient({ titleKey, titleText, products, initialFilters, initialSort }: ProductListingClientProps) {
  const { t, pick } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const title = titleText ? pick(titleText) : t(titleKey ?? "");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const {
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
  } = useProductFilters(products, initialFilters, initialSort);

  const syncUrl = (next: FilterState, nextSort = sort) => {
    const params = new URLSearchParams();
    if (next.sizes.length) params.set("size", next.sizes.join(","));
    if (next.colours.length) params.set("colour", next.colours.join(","));
    if (next.fabrics.length) params.set("fabric", next.fabrics[0]);
    if (next.collections.length) params.set("collection", next.collections[0]);
    if (next.priceRanges.length) {
      params.set("minPrice", String(Math.min(...next.priceRanges.map((range) => range[0]))));
      params.set("maxPrice", String(Math.max(...next.priceRanges.map((range) => range[1]))));
    }
    if (next.inStockOnly) params.set("availability", "in-stock");
    if (next.onSale) params.set("sale", "true");
    if (next.newIn) params.set("new", "true");
    if (nextSort !== "newest") params.set("sort", nextSort === "priceLow" ? "price-low" : nextSort === "priceHigh" ? "price-high" : "popular");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const setSyncedFilters = (value: SetStateAction<FilterState>) => {
    const next = typeof value === "function" ? value(filters) : value;
    setFilters(next);
    syncUrl(next);
  };

  const setSyncedSort = (next: SortOption) => {
    setSort(next);
    syncUrl(filters, next);
  };

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const filterProps = {
    filters,
    setFilters: setSyncedFilters,
    availableSizes,
    availableColours,
    availableFabrics,
    availableCollections,
    onClearAll: () => {
      clearAll();
      router.replace(pathname, { scroll: false });
      setVisibleCount(PAGE_SIZE);
    },
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: title }]} />
      <h1 className="font-serif font-normal text-[32px] sm:text-4xl lg:text-[44px] leading-[1.1] text-ink mt-3 mb-2">
        {title}
      </h1>
      <p className="font-sans font-normal text-sm text-muted mb-8">
        {filteredProducts.length} {t("listing.productsFound")}
      </p>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterPanel {...filterProps} />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex h-11 items-center gap-2 rounded-control font-sans font-medium text-sm text-ink border border-border px-4"
            >
              <SlidersHorizontal size={15} /> {t("listing.filters")}
            </button>
            <div className="ml-auto">
              <label htmlFor="sort" className="sr-only">
                {t("listing.sortBy")}
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSyncedSort(e.target.value as typeof sort)}
                className="h-11 rounded-control border border-border bg-white px-3 font-sans font-medium text-xs sm:text-sm text-ink focus:outline-none focus:border-wine"
              >
                <option value="newest">{t("listing.sortNewest")}</option>
                <option value="priceLow">{t("listing.sortPriceLow")}</option>
                <option value="priceHigh">{t("listing.sortPriceHigh")}</option>
                <option value="popular">{t("listing.sortPopular")}</option>
              </select>
            </div>
          </div>

          <ProductGrid products={visibleProducts} />

          {hasMore && (
            <div className="flex justify-center mt-12 lg:mt-16">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                {t("common.seeMore")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <MobileFilterDrawer isOpen={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} {...filterProps} />
    </Container>
  );
}
