import type { CategorySlug, Product, ProductCategory } from "@/types";
import { formatTaka } from "./format";

/**
 * Retained as the storefront's price helper so existing call sites keep
 * working; the implementation now goes through the shared money formatter in
 * lib/format.ts, which handles fractional amounts (discounts, refunds) instead
 * of silently dropping them.
 */
export function formatPrice(value: number | string | null | undefined): string {
  return formatTaka(value);
}

/**
 * Display names for the four categories that ship with the storefront.
 *
 * Staff can create any number of further categories from /admin/categories, and
 * those are not listed here — which is why this returns null rather than
 * undefined-by-accident, so callers fall through to the slug-derived label
 * instead of rendering an empty category on the product grid.
 */
const builtInCategoryLabels: Record<ProductCategory, string> = {
  "unstitched-three-piece": "Unstitched Three Piece",
  "ready-three-piece": "Ready Three Piece",
  accessories: "Accessories",
  collection: "Collection",
};

export function getBuiltInCategoryLabel(category: CategorySlug): string | null {
  // `Object.hasOwn` rather than a bare lookup: a category slugged "toString",
  // "constructor" or "__proto__" would otherwise resolve to the inherited
  // Object.prototype member — a function, which `?? null` does not catch and
  // which would then be rendered as a React child.
  if (typeof category !== "string" || !Object.hasOwn(builtInCategoryLabels, category)) {
    return null;
  }
  return builtInCategoryLabels[category as ProductCategory];
}

/** "eid-special-2026" → "Eid Special 2026". Last-resort label for a slug. */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The label to show a customer for a product's category.
 *
 * Prefers the English name stored in the database (correct for every category,
 * including ones staff created after launch), falls back to the built-in name
 * for the four shipped routes, and finally derives something readable from the
 * slug. There is no path here that produces an empty string or throws.
 */
export function resolveCategoryLabel(
  product: Pick<Product, "category" | "categoryName">,
): string {
  const fromDatabase = product.categoryName?.trim();
  if (fromDatabase) return fromDatabase;

  const builtIn = getBuiltInCategoryLabel(product.category);
  if (builtIn) return builtIn;

  return humanizeSlug(product.category);
}

/**
 * The URL for a category, or null when it has none.
 *
 * Only the four built-in categories have a top-level route. Staff can create
 * any number of further categories from /admin/categories, and those have no
 * page — so linking to `/<slug>` for one produced a 404 in the product
 * breadcrumb, in the product's BreadcrumbList structured data, and in the
 * sitemap. Callers must treat null as "render the label, do not link it".
 */
export function categoryHref(category: CategorySlug): string | null {
  return getBuiltInCategoryLabel(category) ? `/${category}` : null;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
