import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { CategorySlug, ColourOption, Product, Review } from "@/types";
import type { Json } from "@/types/database";
import { createPublicServerClient } from "../public-server";
import { isSupabaseConfigured } from "../env";
import { logger, logFailure } from "@/lib/logger";
import { describeMissingMigration } from "../errors";

/**
 * Logs a catalogue failure, distinguishing "the migration has not been applied"
 * from a genuine fault.
 *
 * The first is by far the most likely cause of an empty storefront on a fresh
 * environment, and it has a one-line fix — so it is reported as an instruction
 * rather than as an exception, and it is not sent to error monitoring, where it
 * would be an alert nobody can act on from a dashboard.
 */
function logCatalogueFailure(
  event: string,
  error: unknown,
  functionName: string,
  context: Record<string, unknown> = {},
) {
  const migrationHint = describeMissingMigration(error, functionName);
  if (migrationHint) {
    logger.error(`${event}.migration_missing`, { ...context, detail: migrationHint });
    return;
  }
  logFailure(event, error, context);
}
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_REVEALED_PAGES,
  MAX_REVEALED_PRODUCTS,
  type ProductFilters,
} from "@/lib/catalogue-filters";

// The URL encoding lives in lib/catalogue-filters.ts because the filter
// sidebar, which runs in the browser, has to produce exactly the same query
// string this module parses. Re-exported so callers have one import.
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paramsFromProductFilters,
  productFiltersFromParams,
} from "@/lib/catalogue-filters";
export type {
  CatalogueSort,
  PriceBand,
  ProductFilters,
  SearchParamRecord,
} from "@/lib/catalogue-filters";

const clampPageSize = (value: number | undefined) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, value ?? DEFAULT_PAGE_SIZE));

export interface ProductPage {
  products: Product[];
  /** Number of products matching the filters across the whole catalogue. */
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CatalogueFacets {
  sizes: string[];
  colours: string[];
  fabrics: string[];
  collections: string[];
  minPrice: number;
  maxPrice: number;
  total: number;
}

export const EMPTY_FACETS: CatalogueFacets = {
  sizes: [],
  colours: [],
  fabrics: [],
  collections: [],
  minPrice: 0,
  maxPrice: 0,
  total: 0,
};

/**
 * The catalogue read layer.
 *
 * Every listing goes through `public.search_catalogue()`, which applies every
 * filter — including the variant-level ones — inside the database, sorts with a
 * deterministic tiebreak, paginates, and reports the true total for the whole
 * filtered set. See supabase/migrations/0009_catalogue_geography_and_delivery.sql for why that
 * matters: filtering after the page had already been chosen made most of the
 * catalogue unreachable as soon as a shopper ticked a size.
 *
 * There is no offline fallback catalogue any more. An unconfigured environment
 * or a missing table means real misconfiguration, and it surfaces as an empty
 * result and a loud server log rather than as demonstration products quietly
 * standing in for the real ones.
 */

// ---------------------------------------------------------------------------
// Row -> Product
// ---------------------------------------------------------------------------

/**
 * `unstitched_details` and `ready_made_details` are jsonb, and rows written by
 * the bilingual build stored every field as `{ en, bn }`. The storefront is
 * English only and its types say `string`, so a blind cast would render
 * "[object Object]" on the product page for every one of those products.
 */
function englishField(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const bilingual = value as { en?: unknown; bn?: unknown };
    if (typeof bilingual.en === "string") return bilingual.en;
  }
  return "";
}

function unstitchedDetails(value: unknown): Product["unstitchedDetails"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  return {
    kameezFabric: englishField(row.kameezFabric),
    salwarFabric: englishField(row.salwarFabric),
    dupattaFabric: englishField(row.dupattaFabric),
    workDetails: englishField(row.workDetails),
    fabricLength: englishField(row.fabricLength),
    colourInfo: englishField(row.colourInfo),
  };
}

function readyMadeDetails(value: unknown): Product["readyMadeDetails"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const measurements = Array.isArray(row.sizeMeasurements) ? row.sizeMeasurements : [];
  return {
    sizeMeasurements: measurements.map((entry) => {
      const measurement = (entry ?? {}) as Record<string, unknown>;
      return {
        size: englishField(measurement.size),
        chest: englishField(measurement.chest),
        waist: englishField(measurement.waist),
        length: englishField(measurement.length),
      };
    }),
    modelHeight: englishField(row.modelHeight),
    modelWearingSize: englishField(row.modelWearingSize),
    fitInformation: englishField(row.fitInformation),
  };
}

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

function asColours(value: unknown): ColourOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const colour = entry as { name?: unknown; hex?: unknown };
    const name = asString(colour.name).trim();
    if (!name) return [];
    return [{ name, hex: asString(colour.hex, "#000000") }];
  });
}

/** Maps one row of `search_catalogue().items` onto the storefront's Product. */
function toProduct(raw: unknown, reviews: Review[] = []): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const slug = asString(row.slug);
  if (!id || !slug) return null;

  const previousPrice = row.previousPrice == null ? undefined : asNumber(row.previousPrice);

  return {
    id,
    slug,
    name: asString(row.name),
    description: asString(row.description),
    category: asString(row.category, "collection"),
    categoryName: asString(row.categoryName) || undefined,
    price: asNumber(row.price),
    previousPrice,
    images: asStringArray(row.images),
    colours: asColours(row.colours),
    sizes: asStringArray(row.sizes),
    fabric: asString(row.fabric),
    stock: asNumber(row.stock),
    tags: asStringArray(row.tags),
    collection: asString(row.collection),
    isNew: row.isNew === true,
    isSale: row.isSale === true,
    isFeatured: row.isFeatured === true,
    isBestSeller: row.isBestSeller === true,
    rating: asNumber(row.rating),
    reviewCount: asNumber(row.reviewCount),
    productCode: asString(row.productCode),
    careInstructions: asString(row.careInstructions),
    unstitchedDetails: unstitchedDetails(row.unstitchedDetails),
    readyMadeDetails: readyMadeDetails(row.readyMadeDetails),
    // Listing pages carry no review bodies: the card shows a star rating, which
    // comes from the denormalised average on the product row.
    reviews,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function emptyPage(filters: ProductFilters): ProductPage {
  return {
    products: [],
    total: 0,
    page: Math.max(1, filters.page ?? 1),
    pageSize: clampPageSize(filters.pageSize),
    hasMore: false,
  };
}

function toRpcFilters(filters: ProductFilters, limit: number, offset: number): Json {
  return {
    categorySlug: filters.category ?? null,
    collectionSlug: filters.collection ?? null,
    query: filters.query ?? null,
    priceBands: filters.priceBands ?? null,
    sizes: filters.sizes ?? null,
    colours: filters.colours ?? null,
    fabrics: filters.fabrics ?? null,
    collectionNames: filters.collectionNames ?? null,
    inStock: filters.inStock ?? false,
    onSale: filters.onSale ?? false,
    isNew: filters.isNew ?? false,
    featured: filters.featured ?? false,
    bestSeller: filters.bestSeller ?? false,
    sort: filters.sort ?? "newest",
    limit,
    offset,
  } as Json;
}

/**
 * One page of the catalogue, plus the true total.
 *
 * `page` is cumulative on purpose: page 3 returns products 1–72 in one query,
 * not products 49–72. That is what makes the "Load More" listing survive a
 * refresh — the URL says how much has been revealed, and the server renders
 * exactly that much — while a first visit still downloads only 24 products.
 */
const readProducts = unstable_cache(async (filters: ProductFilters): Promise<ProductPage> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = clampPageSize(filters.pageSize);

  if (!isSupabaseConfigured()) {
    logger.error("catalogue.not_configured", {
      detail:
        "The product listing is empty because Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    });
    return emptyPage(filters);
  }

  // The listing is cumulative: page 3 means "the first 72 products", so that a
  // refresh re-renders everything the shopper had revealed. The ceiling matches
  // the one search_catalogue() enforces, so the two can never disagree about
  // how much was returned.
  const limit = Math.min(MAX_REVEALED_PRODUCTS, pageSize * page);
  const supabase = createPublicServerClient();
  const { data, error } = await supabase.rpc("search_catalogue", {
    p_filters: toRpcFilters(filters, limit, 0),
  });

  if (error) {
    logCatalogueFailure("catalogue.search_failed", error, "search_catalogue", { page, pageSize });
    return emptyPage(filters);
  }

  const result = (data ?? {}) as { total?: unknown; items?: unknown };
  const items = Array.isArray(result.items) ? result.items : [];
  const products = items
    .map((item) => toProduct(item))
    .filter((product): product is Product => product !== null);
  const total = asNumber(result.total, products.length);

  return {
    products,
    total,
    page,
    pageSize,
    // Stops offering more once the cumulative ceiling is reached: past that
    // point another request cannot return anything new, and a "Load More"
    // button that does nothing is worse than none.
    hasMore: products.length < total && products.length < MAX_REVEALED_PRODUCTS,
  };
}, ["catalogue-products-v1"], { revalidate: 60, tags: ["catalogue"] });

export function getProducts(filters: ProductFilters = {}): Promise<ProductPage> {
  return readProducts(filters);
}

/**
 * A single slice of the catalogue, for the "Load More" fetch.
 *
 * Unlike getProducts() this returns exactly one page, so appending it to what
 * the browser already holds never repeats or skips a product — the ordering is
 * deterministic in the database.
 */
const readProductSlice = unstable_cache(async (
  filters: ProductFilters,
  page: number,
): Promise<ProductPage> => {
  const pageSize = clampPageSize(filters.pageSize);
  const safePage = Math.max(1, Math.min(MAX_REVEALED_PAGES, page));

  if (!isSupabaseConfigured()) return emptyPage({ ...filters, page: safePage });

  const supabase = createPublicServerClient();
  const { data, error } = await supabase.rpc("search_catalogue", {
    p_filters: toRpcFilters(filters, pageSize, (safePage - 1) * pageSize),
  });

  if (error) {
    logCatalogueFailure("catalogue.slice_failed", error, "search_catalogue", {
      page: safePage,
      pageSize,
    });
    return emptyPage({ ...filters, page: safePage });
  }

  const result = (data ?? {}) as { total?: unknown; items?: unknown };
  const items = Array.isArray(result.items) ? result.items : [];
  const products = items
    .map((item) => toProduct(item))
    .filter((product): product is Product => product !== null);
  const total = asNumber(result.total, products.length);

  return {
    products,
    total,
    page: safePage,
    pageSize,
    hasMore: safePage * pageSize < total && safePage < MAX_REVEALED_PAGES,
  };
}, ["catalogue-product-slice-v1"], { revalidate: 60, tags: ["catalogue"] });

export function getProductSlice(filters: ProductFilters, page: number): Promise<ProductPage> {
  return readProductSlice(filters, page);
}

/**
 * The sidebar's options, computed across the whole scope rather than the page
 * on screen — otherwise a filter disappears from the sidebar as soon as you
 * page past the products that offered it.
 */
const readCatalogueFacets = unstable_cache(async (
  scope: Pick<ProductFilters, "category" | "collection" | "query"> = {},
): Promise<CatalogueFacets> => {
  if (!isSupabaseConfigured()) return EMPTY_FACETS;

  const supabase = createPublicServerClient();
  const { data, error } = await supabase.rpc("catalogue_facets", {
    p_filters: {
      categorySlug: scope.category ?? null,
      collectionSlug: scope.collection ?? null,
      query: scope.query ?? null,
    } as Json,
  });

  if (error) {
    logCatalogueFailure("catalogue.facets_failed", error, "catalogue_facets");
    return EMPTY_FACETS;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    sizes: asStringArray(row.sizes),
    colours: asStringArray(row.colours),
    fabrics: asStringArray(row.fabrics),
    collections: asStringArray(row.collections),
    minPrice: asNumber(row.minPrice),
    maxPrice: asNumber(row.maxPrice),
    total: asNumber(row.total),
  };
}, ["catalogue-facets-v1"], { revalidate: 300, tags: ["catalogue"] });

export function getCatalogueFacets(
  scope: Pick<ProductFilters, "category" | "collection" | "query"> = {},
): Promise<CatalogueFacets> {
  return readCatalogueFacets(scope);
}

export async function getNewArrivals(limit = 8) {
  return (await getProducts({ isNew: true, pageSize: limit })).products;
}
export async function getFeaturedProducts(limit = 8) {
  return (await getProducts({ featured: true, pageSize: limit })).products;
}
export async function getBestSellers(limit = 8) {
  return (await getProducts({ bestSeller: true, pageSize: limit })).products;
}
export async function getProductsByCategory(
  category: CategorySlug,
  filters: ProductFilters = {},
) {
  return getProducts({ ...filters, category });
}
export async function getProductsByCollection(
  collection: string,
  filters: ProductFilters = {},
) {
  return getProducts({ ...filters, collection });
}

export interface PublicCollection {
  slug: string;
  name: string;
  description: string | null;
}

/**
 * A collection a shopper is allowed to see right now.
 *
 * Returns null for one that does not exist, has been deactivated, or is
 * scheduled outside its own start/end window. Every collection entry point goes
 * through this — the dynamic route, the four hand-written seasonal pages, the
 * navigation and the sidebar filter — so a collection can never be withheld
 * from one surface while remaining reachable through another.
 */
const readPublicCollectionBySlug = unstable_cache(async (
  slug: string,
): Promise<PublicCollection | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = createPublicServerClient();
  const { data, error } = await supabase
    .from("collections")
    .select("slug,name_en,description_en,is_active,starts_at,ends_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;

  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return null;
  if (data.ends_at && new Date(data.ends_at).getTime() <= now) return null;

  return {
    slug: data.slug,
    name: data.name_en,
    description: data.description_en,
  };
}, ["public-collection-by-slug-v1"], { revalidate: 300, tags: ["catalogue"] });

export const getPublicCollectionBySlug = cache(readPublicCollectionBySlug);

/** Every collection a shopper may currently browse, for the navigation. */
const readVisibleCollections = unstable_cache(async (): Promise<PublicCollection[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("collections")
    .select("slug,name_en,description_en,sort_order")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("sort_order");

  if (error || !data) return [];
  return data.map((row) => ({
    slug: row.slug,
    name: row.name_en,
    description: row.description_en,
  }));
}, ["visible-collections-v1"], { revalidate: 300, tags: ["catalogue"] });

export const getVisibleCollections = cache(readVisibleCollections);

export async function searchProducts(query: string, limit = 12): Promise<Product[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  return (await getProducts({ query: term, pageSize: Math.min(MAX_PAGE_SIZE, limit) })).products;
}

/**
 * One product, with its approved reviews.
 *
 * This is the only place review bodies are read. The listing pages show a star
 * rating from the product's denormalised average instead, so a 24-product grid
 * no longer drags several hundred review rows across the wire to render none of
 * them.
 */
const readProductBySlug = unstable_cache(async (slug: string): Promise<Product | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicServerClient();
  const { data, error } = await supabase.rpc("search_catalogue", {
    p_filters: { slug, limit: 1, offset: 0 } as Json,
  });

  if (error) {
    logCatalogueFailure("catalogue.product_lookup_failed", error, "search_catalogue", { slug });
    return null;
  }

  const items = Array.isArray((data as { items?: unknown })?.items)
    ? (data as { items: unknown[] }).items
    : [];
  const product = toProduct(items[0]);
  if (!product) return null;

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id,author_name,rating,created_at,title,comment_en,order_item_id")
    .eq("product_id", product.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  product.reviews = (reviewRows ?? []).map((review) => ({
    id: review.id,
    author: review.author_name,
    rating: review.rating,
    date: review.created_at.slice(0, 10),
    title: review.title ?? undefined,
    comment: review.comment_en,
    verifiedPurchase: Boolean(review.order_item_id),
  }));

  return product;
}, ["product-by-slug-v1"], { revalidate: 60, tags: ["catalogue"] });

// generateMetadata() and the page body ask for the same product during one
// render. React cache prevents those concurrent callers from issuing duplicate
// product and review queries even on a cold shared-cache miss.
export const getProductBySlug = cache(readProductBySlug);

/**
 * Several products by slug, in one query.
 *
 * The wishlist rail and the recently-viewed rail each hold a list of slugs. The
 * catalogue API used to resolve them with one getProductBySlug() per slug, and
 * each of those hydrated images, variants, reviews, category and collection —
 * so a twelve-slug request became dozens of database round trips for a strip of
 * thumbnails.
 */
const readProductsBySlugs = unstable_cache(async (slugs: string[]): Promise<Product[]> => {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))].slice(0, 24);
  if (unique.length === 0 || !isSupabaseConfigured()) return [];

  const supabase = createPublicServerClient();
  const { data, error } = await supabase.rpc("search_catalogue", {
    p_filters: { slugs: unique, limit: unique.length, offset: 0 } as Json,
  });

  if (error) {
    logCatalogueFailure("catalogue.slug_lookup_failed", error, "search_catalogue", {
      count: unique.length,
    });
    return [];
  }

  const items = Array.isArray((data as { items?: unknown })?.items)
    ? (data as { items: unknown[] }).items
    : [];
  const bySlug = new Map(
    items
      .map((item) => toProduct(item))
      .filter((product): product is Product => product !== null)
      .map((product) => [product.slug, product]),
  );

  // Returned in the order the caller asked for, so a "recently viewed" rail
  // stays in the order the customer actually viewed them.
  return unique.flatMap((slug) => {
    const product = bySlug.get(slug);
    return product ? [product] : [];
  });
}, ["products-by-slugs-v1"], { revalidate: 60, tags: ["catalogue"] });

export function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  return readProductsBySlugs(slugs);
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const result = await getProducts({
    category: product.category,
    pageSize: limit + 1,
  });
  return result.products.filter((item) => item.id !== product.id).slice(0, limit);
}
