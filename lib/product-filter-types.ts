export type SortOption = "newest" | "priceLow" | "priceHigh" | "popular";

export interface FilterState {
  priceRanges: [number, number][];
  sizes: string[];
  colours: string[];
  fabrics: string[];
  collections: string[];
  inStockOnly: boolean;
  onSale: boolean;
  newIn: boolean;
}

export const emptyFilterState: FilterState = {
  priceRanges: [],
  sizes: [],
  colours: [],
  fabrics: [],
  collections: [],
  inStockOnly: false,
  onSale: false,
  newIn: false,
};
