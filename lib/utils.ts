import type { ProductCategory } from "@/types";

export function formatPrice(value: number): string {
  return `৳${value.toLocaleString("en-US")}`;
}

const categoryTranslationKeys: Record<ProductCategory, string> = {
  "unstitched-three-piece": "nav.unstitched",
  "ready-three-piece": "nav.ready",
  accessories: "nav.accessories",
  collection: "nav.collection",
};

export function getCategoryTranslationKey(category: ProductCategory): string {
  return categoryTranslationKeys[category];
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
