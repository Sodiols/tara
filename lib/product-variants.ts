import type { ColourOption, ProductVariant } from "@/types";
import { sortSizes } from "./product-size";

/**
 * What a customer is allowed to choose, derived from the real variant matrix.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * ------------------------------
 * The storefront used to select from `product.sizes` and `product.colours`,
 * which `search_catalogue()` builds with `distinct` — two independent lists
 * with the pairing thrown away. For a product stocked as
 *
 *     38 / Black    40 / Maroon    42 / Black
 *
 * those flatten to sizes [38, 40, 42] and colours [Black, Maroon], and every
 * one of the six combinations looked selectable. Three of them do not exist.
 * A customer could put (40, Black) in their bag, fill in the whole checkout
 * form, and only then be told "a selected product option is no longer
 * available" — because `place_order()` is authoritative and correctly refused
 * to invent a variant. Nothing could be mispriced or oversold by this; it was
 * a dead end at the last step of the funnel, which is the most expensive place
 * to put one.
 *
 * Everything here is pure and total. No React, no fetching, no throwing — the
 * same functions run in the product page, in Quick View, and in the tests that
 * pin the matrix behaviour.
 *
 * A NOTE ON "UNAVAILABLE"
 * -----------------------
 * Two different things stop a combination being buyable and a shopper deserves
 * to be told which: it may not exist at all (38 never came in Maroon), or it
 * may exist and be sold out. Both disable the control; `unavailableReason()`
 * is what puts the difference into the accessible name.
 */

/** A colour axis entry, plus whether anything can be bought in it right now. */
export interface ColourChoice extends ColourOption {
  /** At least one in-stock variant exists for this colour and the current size. */
  selectable: boolean;
}

/** A size axis entry, plus whether anything can be bought in it right now. */
export interface SizeChoice {
  size: string;
  selectable: boolean;
}

export interface Selection {
  size: string;
  /** "" when the product has no colour axis. */
  colour: string;
}

const colourKey = (variant: ProductVariant) => variant.colour?.name ?? "";

/** True when this product is sold in more than one colour. */
export function hasColourAxis(variants: readonly ProductVariant[]): boolean {
  return variants.some((variant) => variant.colour !== null);
}

/**
 * Every size the product comes in, in garment order rather than the
 * alphabetical order the database returns.
 */
export function allSizes(variants: readonly ProductVariant[]): string[] {
  return sortSizes([...new Set(variants.map((variant) => variant.size))]);
}

/**
 * Every colour the product comes in, first-seen order preserved so the swatch
 * row does not reshuffle when a size is picked.
 */
export function allColours(variants: readonly ProductVariant[]): ColourOption[] {
  const seen = new Map<string, ColourOption>();
  for (const variant of variants) {
    if (variant.colour && !seen.has(variant.colour.name)) {
      seen.set(variant.colour.name, variant.colour);
    }
  }
  return [...seen.values()];
}

/** The variant for an exact combination, or null when there is no such row. */
export function findVariant(
  variants: readonly ProductVariant[],
  size: string,
  colour: string,
): ProductVariant | null {
  return (
    variants.find(
      (variant) => variant.size === size && colourKey(variant) === colour,
    ) ?? null
  );
}

/**
 * Why a combination cannot be bought, or null when it can.
 *
 * The distinction is the whole point: "Out of stock" tells a shopper to come
 * back, "Unavailable" tells them to stop looking for it.
 */
export function unavailableReason(
  variants: readonly ProductVariant[],
  size: string,
  colour: string,
): "missing" | "out-of-stock" | null {
  const variant = findVariant(variants, size, colour);
  if (!variant) return "missing";
  return variant.available ? null : "out-of-stock";
}

/**
 * The size axis, with each entry marked selectable against the chosen colour.
 *
 * Sizes are never removed from the list, only disabled. A row of controls that
 * changes length as you pick a colour makes a shopper lose their place and
 * hides the fact that the size exists at all — "42 is sold out in Maroon" is
 * information; a vanished button is not.
 */
export function sizeChoices(
  variants: readonly ProductVariant[],
  colour: string,
): SizeChoice[] {
  return allSizes(variants).map((size) => ({
    size,
    selectable: variants.some(
      (variant) =>
        variant.size === size &&
        variant.available &&
        (colour === "" || colourKey(variant) === colour),
    ),
  }));
}

/** The colour axis, with each entry marked selectable against the chosen size. */
export function colourChoices(
  variants: readonly ProductVariant[],
  size: string,
): ColourChoice[] {
  return allColours(variants).map((colour) => ({
    ...colour,
    selectable: variants.some(
      (variant) =>
        colourKey(variant) === colour.name &&
        variant.available &&
        (size === "" || variant.size === size),
    ),
  }));
}

/**
 * The combination to open the page on: the first one a customer could actually
 * buy, in garment size order, falling back to the first row that exists so a
 * fully sold-out product still renders a coherent (disabled) selection rather
 * than an empty one.
 */
export function defaultSelection(variants: readonly ProductVariant[]): Selection {
  const order = allSizes(variants);
  const bySize = (a: ProductVariant, b: ProductVariant) =>
    order.indexOf(a.size) - order.indexOf(b.size);

  const buyable = variants.filter((variant) => variant.available).sort(bySize)[0];
  const fallback = [...variants].sort(bySize)[0];
  const chosen = buyable ?? fallback;
  if (!chosen) return { size: "", colour: "" };
  return { size: chosen.size, colour: colourKey(chosen) };
}

/**
 * Moves a selection to the nearest valid one after the shopper changes an axis.
 *
 * Picking Maroon when the current size is 38 — which never came in Maroon —
 * must not leave (38, Maroon) selected. The axis the shopper just touched is
 * honoured and the *other* one moves to its first buyable value; if the colour
 * they picked has nothing in stock at all, the selection still lands on a real
 * row of that colour so the UI can say "sold out" about something true.
 *
 * @param changed which axis the shopper just moved. That one is never overridden.
 */
export function resolveSelection(
  variants: readonly ProductVariant[],
  desired: Selection,
  changed: "size" | "colour",
): Selection {
  if (variants.length === 0) return { size: "", colour: "" };
  if (findVariant(variants, desired.size, desired.colour)?.available) return desired;

  const order = allSizes(variants);
  const candidates = variants
    .filter((variant) =>
      changed === "colour"
        ? colourKey(variant) === desired.colour
        : variant.size === desired.size,
    )
    .sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));

  const next = candidates.find((variant) => variant.available) ?? candidates[0];
  if (!next) return defaultSelection(variants);
  return { size: next.size, colour: colourKey(next) };
}

/**
 * How many of the selected combination may be added.
 *
 * The selected variant's own stock, never the product total. The product page
 * used to cap quantity at `product.stock`, which `search_catalogue()` computes
 * as `sum(stock_quantity)` across every variant — so a shopper who picked the
 * size with one left was offered ten, and `place_order()` rejected the order
 * after the checkout form had been filled in.
 *
 * `cap` is the per-line ceiling the cart and `place_order()` both enforce.
 */
export function maxQuantityFor(
  variant: ProductVariant | null,
  cap: number,
): number {
  if (!variant || !variant.available) return 0;
  return Math.max(0, Math.min(cap, variant.stock));
}

/**
 * Does buying this product involve a choice?
 *
 * Answered from the flattened summary on purpose, because this is the one
 * question the summary can answer safely. If a product advertises at most one
 * size and at most one colour then at most one combination exists, so adding it
 * straight from a listing cannot pick the wrong one. Anything more than that
 * and the pairing matters — and a listing row does not carry the pairing, so
 * the only honest move is to send the shopper somewhere that does.
 *
 * This is what stopped the product card and Quick View adding
 * `sizes[0] + colours[0]`: for the 38/Black, 40/Maroon, 42/Black product that
 * is (38, Black) for one shopper and a checkout rejection for the next.
 */
export function requiresVariantChoice(product: {
  sizes: readonly string[];
  colours: readonly unknown[];
}): boolean {
  return product.sizes.length > 1 || product.colours.length > 1;
}
