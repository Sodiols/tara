import "server-only";

import type { Product, ProductCategory, Review } from "@/types";
import type { Database, Json } from "@/types/database";
import { products as seedProducts } from "@/data/products";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

export interface ProductFilters {
  category?: ProductCategory;
  collection?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colours?: string[];
  fabric?: string;
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  featured?: boolean;
  bestSeller?: boolean;
  sort?: "newest" | "price-low" | "price-high" | "popular";
  page?: number;
  pageSize?: number;
}

export function productFiltersFromParams(params: Record<string, string | string[] | undefined>): ProductFilters {
  const text = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const list = (key: string) => text(key)?.split(",").map((value) => value.trim()).filter(Boolean);
  const minPrice = Number(text("minPrice"));
  const maxPrice = Number(text("maxPrice"));
  const sortValue = text("sort");
  return {
    query: text("q"),
    minPrice: Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) && maxPrice >= 0 ? maxPrice : undefined,
    sizes: list("size"),
    colours: list("colour"),
    fabric: text("fabric"),
    inStock: text("availability") === "in-stock",
    isNew: text("new") === "true",
    onSale: text("sale") === "true",
    sort: sortValue === "price-low" || sortValue === "price-high" || sortValue === "popular" ? sortValue : "newest",
    page: Math.max(1, Number(text("page")) || 1),
    pageSize: 24,
  };
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type QueryError = { code?: string; message?: string } | null;

function isMissingCatalogSchema(error: QueryError) {
  return Boolean(
    error &&
      (error.code === "PGRST205" ||
        error.message?.includes("Could not find the table")),
  );
}

function fallbackProducts(filters: ProductFilters = {}): ProductPage {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  const normalizedCollection = filters.collection?.replaceAll("-", " ").toLowerCase();
  const searchTerm = filters.query?.trim().toLowerCase();
  let filtered = seedProducts.filter((product) => {
    if (filters.category && product.category !== filters.category) return false;
    if (
      normalizedCollection &&
      product.collection.replaceAll("-", " ").toLowerCase() !== normalizedCollection
    ) return false;
    if (
      searchTerm &&
      ![
        product.name.en,
        product.name.bn,
        product.productCode,
        product.fabric.en,
        product.fabric.bn,
        product.collection,
        ...product.tags,
      ].some((value) => value.toLowerCase().includes(searchTerm))
    ) return false;
    if (filters.minPrice != null && product.price < filters.minPrice) return false;
    if (filters.maxPrice != null && product.price > filters.maxPrice) return false;
    if (
      filters.fabric &&
      !product.fabric.en.toLowerCase().includes(filters.fabric.toLowerCase())
    ) return false;
    if (filters.isNew && !product.isNew) return false;
    if (filters.onSale && !product.isSale) return false;
    if (filters.featured && !product.isFeatured) return false;
    if (filters.bestSeller && !product.isBestSeller) return false;
    if (filters.inStock && product.stock < 1) return false;
    if (
      filters.sizes?.length &&
      !product.sizes.some((size) => filters.sizes?.includes(size))
    ) return false;
    if (
      filters.colours?.length &&
      !product.colours.some((colour) => filters.colours?.includes(colour.name.en))
    ) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (filters.sort === "price-low") return a.price - b.price;
    if (filters.sort === "price-high") return b.price - a.price;
    if (filters.sort === "popular")
      return b.rating * b.reviewCount - a.rating * a.reviewCount;
    return Number(b.isNew) - Number(a.isNew);
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    products: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

// The static seed catalog may only stand in for a broken/unconfigured
// database outside production. In production, an unconfigured Supabase env
// var or a missing catalog table always means real misconfiguration (a
// cleared env var, an incomplete migration) — it must surface as an empty
// result and a loud server log for administrators to notice and fix, never
// as demonstration products silently served in place of the real catalog.
const ALLOW_DEV_CATALOG_FALLBACK = process.env.NODE_ENV !== "production";

function emptyProductPage(filters: ProductFilters): ProductPage {
  return {
    products: [],
    total: 0,
    page: Math.max(1, filters.page ?? 1),
    pageSize: Math.min(48, Math.max(1, filters.pageSize ?? 24)),
    hasMore: false,
  };
}

function devFallbackProductPage(filters: ProductFilters, reason: string): ProductPage {
  if (ALLOW_DEV_CATALOG_FALLBACK) return fallbackProducts(filters);
  console.error(
    `[catalog] Product listing unavailable in production (${reason}). Serving an empty result instead of demonstration data — check NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and that supabase/TARA_COMPLETE_SETUP.sql has been run.`,
  );
  return emptyProductPage(filters);
}

function devFallbackProductList(filters: ProductFilters, reason: string): Product[] {
  if (ALLOW_DEV_CATALOG_FALLBACK) return fallbackProducts(filters).products;
  console.error(
    `[catalog] Product search unavailable in production (${reason}). Returning no results instead of demonstration data.`,
  );
  return [];
}

function devFallbackProductBySlug(slug: string, reason: string): Product | null {
  if (ALLOW_DEV_CATALOG_FALLBACK) return seedProducts.find((product) => product.slug === slug) ?? null;
  console.error(
    `[catalog] Product lookup unavailable in production (${reason}). Returning not-found instead of demonstration data.`,
  );
  return null;
}

function localizedJson(value: Json | null) {
  return (value ?? undefined) as Product["unstitchedDetails"];
}

function readyMadeJson(value: Json | null) {
  return (value ?? undefined) as Product["readyMadeDetails"];
}

async function hydrateProducts(rows: ProductRow[]): Promise<Product[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = rows.map((row) => row.id);

  const [imagesResult, variantsResult, reviewsResult, categoryResult, collectionResult] =
    await Promise.all([
      supabase
        .from("product_images")
        .select("*")
        .in("product_id", ids)
        .order("sort_order"),
      supabase
        .from("product_variants")
        .select("*")
        .in("product_id", ids)
        .eq("is_active", true),
      supabase
        .from("reviews")
        .select("*")
        .in("product_id", ids)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id,slug")
        .in("id", [...new Set(rows.map((row) => row.category_id))]),
      supabase
        .from("collections")
        .select("id,name_en")
        .in(
          "id",
          [...new Set(rows.map((row) => row.collection_id).filter(Boolean))] as string[],
        ),
    ]);

  const images = (imagesResult.data ?? []) as ProductImageRow[];
  const variants = (variantsResult.data ?? []) as ProductVariantRow[];
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const categoryById = new Map(
    (categoryResult.data ?? []).map((item) => [item.id, item.slug]),
  );
  const collectionById = new Map(
    (collectionResult.data ?? []).map((item) => [item.id, item.name_en]),
  );

  return rows.map((row) => {
    const productImages = images.filter((image) => image.product_id === row.id);
    const productVariants = variants.filter(
      (variant) => variant.product_id === row.id,
    );
    const colours = [
      ...new Map(
        productVariants.map((variant) => [
          variant.colour_en,
          {
            name: { en: variant.colour_en, bn: variant.colour_bn },
            hex: variant.colour_hex,
          },
        ]),
      ).values(),
    ];
    const productReviews: Review[] = reviews
      .filter((review) => review.product_id === row.id)
      .map((review) => ({
        id: review.id,
        author: review.author_name,
        rating: review.rating,
        date: review.created_at.slice(0, 10),
        comment: {
          en: review.comment_en,
          bn: review.comment_bn || review.comment_en,
        },
      }));

    return {
      id: row.id,
      slug: row.slug,
      name: { en: row.name_en, bn: row.name_bn },
      description: { en: row.description_en, bn: row.description_bn },
      category:
        (categoryById.get(row.category_id) as ProductCategory | undefined) ??
        "collection",
      price: Number(row.base_price),
      previousPrice:
        row.compare_at_price == null ? undefined : Number(row.compare_at_price),
      images: productImages.map((image) => image.image_url),
      colours,
      sizes: [...new Set(productVariants.map((variant) => variant.size))],
      fabric: { en: row.fabric_en, bn: row.fabric_bn },
      stock: productVariants.reduce(
        (total, variant) => total + variant.stock_quantity,
        0,
      ),
      tags: row.tags,
      collection: row.collection_id
        ? collectionById.get(row.collection_id) ?? ""
        : "",
      isNew: row.is_new,
      isSale: row.compare_at_price != null,
      isFeatured: row.is_featured,
      isBestSeller: row.is_best_seller,
      rating: Number(row.average_rating),
      reviewCount: row.review_count,
      productCode: row.product_code,
      careInstructions: {
        en: row.care_instructions_en,
        bn: row.care_instructions_bn,
      },
      unstitchedDetails: localizedJson(row.unstitched_details),
      readyMadeDetails: readyMadeJson(row.ready_made_details),
      reviews: productReviews,
    };
  });
}

export async function getProducts(
  filters: ProductFilters = {},
): Promise<ProductPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  if (!isSupabaseConfigured()) return devFallbackProductPage(filters, "Supabase not configured");
  const supabase = await createClient();

  let categoryId: string | undefined;
  let collectionId: string | undefined;
  if (filters.category) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    if (isMissingCatalogSchema(error)) return devFallbackProductPage(filters, "categories table missing");
    categoryId = data?.id;
    if (!categoryId) return { products: [], total: 0, page, pageSize, hasMore: false };
  }
  if (filters.collection) {
    const { data, error } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", filters.collection)
      .maybeSingle();
    if (isMissingCatalogSchema(error)) return devFallbackProductPage(filters, "collections table missing");
    collectionId = data?.id;
    if (!collectionId) return { products: [], total: 0, page, pageSize, hasMore: false };
  }

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("status", "active");
  if (categoryId) query = query.eq("category_id", categoryId);
  if (collectionId) query = query.eq("collection_id", collectionId);
  if (filters.query) {
    const safe = filters.query.replaceAll(/[%(),]/g, " ").trim();
    query = query.or(
      `name_en.ilike.%${safe}%,name_bn.ilike.%${safe}%,product_code.ilike.%${safe}%`,
    );
  }
  if (filters.minPrice != null) query = query.gte("base_price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("base_price", filters.maxPrice);
  if (filters.fabric) query = query.ilike("fabric_en", `%${filters.fabric}%`);
  if (filters.isNew) query = query.eq("is_new", true);
  if (filters.onSale) query = query.not("compare_at_price", "is", null);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.bestSeller) query = query.eq("is_best_seller", true);

  if (filters.sort === "price-low") query = query.order("base_price");
  else if (filters.sort === "price-high")
    query = query.order("base_price", { ascending: false });
  else if (filters.sort === "popular")
    query = query.order("review_count", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const start = (page - 1) * pageSize;
  const { data, count, error } = await query.range(start, start + pageSize - 1);
  if (error) {
    if (isMissingCatalogSchema(error)) return devFallbackProductPage(filters, "products table missing");
    console.error("Product query failed:", error.message);
    return { products: [], total: 0, page, pageSize, hasMore: false };
  }

  let rows = data ?? [];
  if (
    filters.sizes?.length ||
    filters.colours?.length ||
    filters.inStock
  ) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("product_id,size,colour_en,stock_quantity")
      .in("product_id", rows.map((row) => row.id))
      .eq("is_active", true);
    const allowed = new Set(
      (variants ?? [])
        .filter(
          (variant) =>
            (!filters.sizes?.length || filters.sizes.includes(variant.size)) &&
            (!filters.colours?.length ||
              filters.colours.includes(variant.colour_en)) &&
            (!filters.inStock || variant.stock_quantity > 0),
        )
        .map((variant) => variant.product_id),
    );
    rows = rows.filter((row) => allowed.has(row.id));
  }

  const products = await hydrateProducts(rows);
  const total = count ?? products.length;
  return { products, total, page, pageSize, hasMore: start + pageSize < total };
}

export async function getActiveProducts(limit = 24) {
  return (await getProducts({ pageSize: limit })).products;
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
  category: ProductCategory,
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
export async function searchProducts(query: string, limit = 12) {
  const term = query.trim();
  if (term.length < 2) return [];
  if (!isSupabaseConfigured())
    return devFallbackProductList({ query: term, pageSize: limit }, "Supabase not configured");
  const supabase = await createClient();
  const safe = term.replaceAll(/[%(),]/g, " ");
  const [directResult, taggedResult, categoryResult, collectionResult] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active").or(`name_en.ilike.%${safe}%,name_bn.ilike.%${safe}%,product_code.ilike.%${safe}%`).limit(limit),
    supabase.from("products").select("*").eq("status", "active").contains("tags", [term.toLowerCase()]).limit(limit),
    supabase.from("categories").select("id").eq("is_active", true).or(`name_en.ilike.%${safe}%,name_bn.ilike.%${safe}%`),
    supabase.from("collections").select("id").eq("is_active", true).or(`name_en.ilike.%${safe}%,name_bn.ilike.%${safe}%`),
  ]);
  if (
    [directResult.error, taggedResult.error, categoryResult.error, collectionResult.error]
      .some(isMissingCatalogSchema)
  ) {
    return devFallbackProductList({ query: term, pageSize: limit }, "products table missing");
  }
  const direct = directResult.data;
  const tagged = taggedResult.data;
  const categories = categoryResult.data;
  const collections = collectionResult.data;
  const [categoryProducts, collectionProducts] = await Promise.all([
    categories?.length
      ? supabase.from("products").select("*").eq("status", "active").in("category_id", categories.map((item) => item.id)).limit(limit)
      : Promise.resolve({ data: [] as ProductRow[] }),
    collections?.length
      ? supabase.from("products").select("*").eq("status", "active").in("collection_id", collections.map((item) => item.id)).limit(limit)
      : Promise.resolve({ data: [] as ProductRow[] }),
  ]);
  const unique = new Map<string, ProductRow>();
  [...(direct ?? []), ...(tagged ?? []), ...(categoryProducts.data ?? []), ...(collectionProducts.data ?? [])]
    .forEach((row) => unique.set(row.id, row));
  return hydrateProducts([...unique.values()].slice(0, limit));
}

export async function getProductBySlug(slug: string) {
  if (!isSupabaseConfigured())
    return devFallbackProductBySlug(slug, "Supabase not configured");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (isMissingCatalogSchema(error))
    return devFallbackProductBySlug(slug, "products table missing");
  if (error || !data) return null;
  return (await hydrateProducts([data]))[0] ?? null;
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const result = await getProducts({
    category: product.category,
    pageSize: limit + 1,
  });
  return result.products.filter((item) => item.id !== product.id).slice(0, limit);
}

export async function getProductVariants(productId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .eq("is_active", true);
  return data ?? [];
}

export async function getProductReviews(productId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  return data ?? [];
}
