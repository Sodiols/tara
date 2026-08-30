import type { Product, ProductImageMedia } from "@/types";

/**
 * Alt text for product photographs.
 *
 * `product_images.alt_en` has been editable in the admin panel since the image
 * manager was built, but the storefront never received it — every image fell
 * back to the product name, so a five-photograph gallery announced the same
 * sentence five times to a screen reader and told a crawler nothing about any
 * individual image.
 *
 * The rules, in order:
 *
 *   1. Staff-written alt text wins. It is the only description that knows what
 *      the photograph actually shows.
 *   2. Otherwise the product name, for the FIRST image only. That image stands
 *      for the product in listings and social previews, so it needs a real
 *      description rather than none.
 *   3. Otherwise empty. A gallery thumbnail with no alt of its own is
 *      decorative — the product has already been named — and repeating the
 *      name is worse than silence for anyone listening to the page.
 *
 * Deliberately NOT done: appending "Bangladesh", "online", "buy" or category
 * words. Alt text describes an image for someone who cannot see it. Keyword
 * padding there is both useless for ranking and actively hostile to the people
 * the attribute exists for.
 */
export function imageAlt(
  media: ProductImageMedia | undefined,
  productName: string,
  index: number,
): string {
  const stored = media?.alt?.trim();
  if (stored) return stored;
  return index === 0 ? productName : "";
}

/**
 * Alt text for the image that represents the product elsewhere — a card, a
 * carousel, an Open Graph preview. Always non-empty: in those places the image
 * IS the link, so it must carry a name.
 */
export function primaryImageAlt(product: Pick<Product, "media" | "name">): string {
  const primary = product.media.find((item) => item.isPrimary) ?? product.media[0];
  return primary?.alt?.trim() || product.name;
}

/** The media entry for a given gallery position, tolerating a short array. */
export function mediaAt(
  media: readonly ProductImageMedia[],
  index: number,
): ProductImageMedia | undefined {
  return media[index];
}
