/**
 * Catalogue filter state and its URL encoding.
 *
 * Deliberately free of any server-only import: the listing page parses the URL
 * on the server, and the filter sidebar rebuilds it in the browser, and both
 * must produce byte-identical query strings. Two implementations of this would
 * drift, and the symptom would be a shopper's filter quietly resetting on
 * refresh.
 */

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 96;

/**
 * The furthest "Load More" will go before the shopper has to narrow the list.
 *
 * The listing renders cumulatively — page 3 means "the first 72 products" — so
 * this is also the ceiling on how much one request can ask the database for:
 * MAX_REVEALED_PAGES * DEFAULT_PAGE_SIZE = 480, which is exactly the cap
 * `search_catalogue()` enforces. The two have to agree, or a refresh deep in a
 * long list would render fewer products than were on screen while the client
 * still believed more were coming.
 */
export const MAX_REVEALED_PAGES = 20;
export const MAX_REVEALED_PRODUCTS = MAX_REVEALED_PAGES * DEFAULT_PAGE_SIZE;

/** A price band the shopper ticked. Bands stay disjoint; they are OR-ed. */
export interface PriceBand {
  min: number;
  max: number;
}

export type CatalogueSort = "newest" | "price-low" | "price-high" | "popular";

export const CATALOGUE_SORTS: readonly CatalogueSort[] = [
  "newest",
  "price-low",
  "price-high",
  "popular",
];

export const SORT_LABELS: Record<CatalogueSort, string> = {
  newest: "Newest First",
  "price-low": "Price: Low to High",
  "price-high": "Price: High to Low",
  popular: "Most Popular",
};

/**
 * The bands offered in the sidebar.
 *
 * Ticking two of them means "either of these", and that is exactly what gets
 * sent. The previous encoding collapsed every ticked band into one
 * minPrice/maxPrice pair, so choosing ৳0–1,500 and ৳3,500–10,000 silently asked
 * for ৳0–10,000 and showed the shopper the ৳2,000 products they had gone out of
 * their way to exclude.
 */
export const PRICE_BANDS: readonly PriceBand[] = [
  { min: 0, max: 1500 },
  { min: 1500, max: 2500 },
  { min: 2500, max: 3500 },
  { min: 3500, max: 10000 },
];

export interface ProductFilters {
  category?: string;
  collection?: string;
  query?: string;
  priceBands?: PriceBand[];
  sizes?: string[];
  colours?: string[];
  fabrics?: string[];
  /** Collection display names, from the sidebar's multi-select. */
  collectionNames?: string[];
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  featured?: boolean;
  bestSeller?: boolean;
  sort?: CatalogueSort;
  page?: number;
  pageSize?: number;
}

export type SearchParamRecord = Record<string, string | string[] | undefined>;

function firstValue(params: SearchParamRecord, key: string): string | undefined {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

function listValue(params: SearchParamRecord, key: string): string[] | undefined {
  const raw = firstValue(params, key);
  if (!raw) return undefined;
  const items = [
    ...new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        // A bounded list: the value is attacker-supplied and ends up as an
        // array parameter in a database query.
        .slice(0, 40),
    ),
  ];
  return items.length ? items : undefined;
}

/**
 * `price=0-1500,3500-10000` — each band intact.
 *
 * `minPrice` / `maxPrice` are still accepted so links shared before this change
 * keep working; they collapse to a single band, which is what they meant.
 */
function parsePriceBands(params: SearchParamRecord): PriceBand[] | undefined {
  const bands: PriceBand[] = [];

  for (const entry of listValue(params, "price") ?? []) {
    // Matched strictly rather than split on "-": splitting turns "-5--1" into
    // ["", "5", "", "1"], and `Number("")` is 0, so a malformed band quietly
    // became the very real band ৳0–৳5.
    const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(entry);
    if (!match) continue;
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
      bands.push({ min, max });
    }
  }

  if (bands.length === 0) {
    const min = Number(firstValue(params, "minPrice"));
    const max = Number(firstValue(params, "maxPrice"));
    const hasMin = Number.isFinite(min) && min >= 0;
    const hasMax = Number.isFinite(max) && max >= 0;
    if (hasMin || hasMax) {
      bands.push({ min: hasMin ? min : 0, max: hasMax ? max : Number.MAX_SAFE_INTEGER });
    }
  }

  return bands.length ? bands : undefined;
}

export function parseSort(value: string | undefined): CatalogueSort {
  return CATALOGUE_SORTS.includes(value as CatalogueSort)
    ? (value as CatalogueSort)
    : "newest";
}

/**
 * The URL is the whole filter state.
 *
 * Everything a shopper can choose is represented here, which is what makes a
 * filtered listing shareable, reload-safe and correct after the back button.
 */
export function productFiltersFromParams(params: SearchParamRecord): ProductFilters {
  const page = Number(firstValue(params, "page"));
  return {
    query: firstValue(params, "q")?.slice(0, 100),
    priceBands: parsePriceBands(params),
    sizes: listValue(params, "size"),
    colours: listValue(params, "colour"),
    fabrics: listValue(params, "fabric"),
    collectionNames: listValue(params, "collection"),
    inStock: firstValue(params, "availability") === "in-stock",
    isNew: firstValue(params, "new") === "true",
    onSale: firstValue(params, "sale") === "true",
    sort: parseSort(firstValue(params, "sort")),
    page:
      Number.isFinite(page) && page >= 1
        ? Math.min(MAX_REVEALED_PAGES, Math.floor(page))
        : 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/** Rebuilds a query string from filter state. The exact inverse of the parser. */
export function paramsFromProductFilters(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.priceBands?.length) {
    params.set("price", filters.priceBands.map((band) => `${band.min}-${band.max}`).join(","));
  }
  if (filters.sizes?.length) params.set("size", filters.sizes.join(","));
  if (filters.colours?.length) params.set("colour", filters.colours.join(","));
  if (filters.fabrics?.length) params.set("fabric", filters.fabrics.join(","));
  if (filters.collectionNames?.length) {
    params.set("collection", filters.collectionNames.join(","));
  }
  if (filters.inStock) params.set("availability", "in-stock");
  if (filters.onSale) params.set("sale", "true");
  if (filters.isNew) params.set("new", "true");
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function isPriceBandSelected(
  selected: PriceBand[] | undefined,
  band: PriceBand,
): boolean {
  return Boolean(selected?.some((entry) => entry.min === band.min && entry.max === band.max));
}

export function togglePriceBand(
  selected: PriceBand[] | undefined,
  band: PriceBand,
): PriceBand[] {
  const current = selected ?? [];
  return isPriceBandSelected(current, band)
    ? current.filter((entry) => !(entry.min === band.min && entry.max === band.max))
    : [...current, band];
}

export function toggleListValue(current: string[] | undefined, value: string): string[] {
  const list = current ?? [];
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/** True when the shopper has narrowed the listing in any way at all. */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return Boolean(
    filters.priceBands?.length ||
      filters.sizes?.length ||
      filters.colours?.length ||
      filters.fabrics?.length ||
      filters.collectionNames?.length ||
      filters.inStock ||
      filters.onSale ||
      filters.isNew,
  );
}
