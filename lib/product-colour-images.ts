import type { ColourOption, ProductImageMedia, ProductVariant } from "@/types";

/**
 * Which photographs belong to which colourway.
 *
 * THE RULE, IN ONE PLACE
 * ----------------------
 * An image belongs to a colour when `media.colourId` equals that colour's
 * `product_colours.id`. Nothing here compares colour NAMES, and nothing treats
 * a position in the array as meaningful — both were how the storefront used to
 * guess, and both are wrong the moment a colour is renamed or an image is
 * reordered.
 *
 * Every component that needs "the Maroon pictures" calls into this module, so
 * the product page, the cart line, the order snapshot and the tests cannot
 * develop three slightly different answers.
 */

/** Colour name comparison for the admin panel: "Black", "black" and " Black " are one colour. */
export function normaliseColourName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * One colour group as the create screen holds it, reduced to what the rule
 * needs: a name and how many files are in it.
 *
 * Structural rather than an import of the component's ColourDraft, so this
 * stays a leaf module with no React or DOM types in it — which is also what
 * lets the test runner load it.
 */
export interface ColourGroupLike {
  name: string;
  images: readonly unknown[];
}

/**
 * What is wrong with the colour groups, in one sentence, or null when nothing
 * is.
 *
 * Runs before the product row is created, so a duplicate name costs a render
 * rather than a half-built product: the database would refuse the second
 * "black" through its case-folded unique index, but by then the product and
 * some of its uploads already exist.
 */
/**
 * The naming half of the rule, on its own.
 *
 * Every colour needs a name, and no two may be the same colour once case and
 * spacing are ignored — "Black" and " black" would be one colour to the
 * database's unique index and two to the person typing. Used by the Product
 * Builder, where a colour is defined for its variants whether or not it has
 * photographs of its own.
 */
export function describeColourNameProblems(
  colours: readonly { name: string }[],
): string | null {
  const seen = new Map<string, string>();
  for (const colour of colours) {
    const name = colour.name.trim();
    if (!name) return "Give every colour a name.";

    const key = normaliseColourName(name);
    const existing = seen.get(key);
    if (existing) {
      return `"${name}" and "${existing}" are the same colour. Give each one a different name.`;
    }
    seen.set(key, name);
  }
  return null;
}

export function describeColourProblems(colours: readonly ColourGroupLike[]): string | null {
  if (colours.length === 0) return "Add at least one colour, or turn colour options off.";

  const naming = describeColourNameProblems(colours);
  if (naming) return naming;

  const empty = colours.find((colour) => colour.images.length === 0);
  if (empty) {
    return `${empty.name.trim()} has no photographs yet. Add at least one, or remove the colour.`;
  }
  return null;
}

/**
 * The photographs to show for one colour, in gallery order.
 *
 * The fallback chain matters more than the happy path, because most of the
 * catalogue will sit in it for a long time: a product whose images were
 * uploaded before colours existed has every image un-assigned, and a colour an
 * administrator created but has not photographed yet has none of its own.
 *
 *   1. that colour's own photographs, when it has any;
 *   2. otherwise the general photographs — images with no colour at all, which
 *      is exactly what every pre-0025 product has;
 *   3. otherwise every photograph the product has, so a product whose images
 *      are ALL assigned to other colours still renders something rather than an
 *      empty frame.
 *
 * Returns an empty array only when the product genuinely has no images; the
 * caller handles that once, in the gallery.
 */
export function mediaForColour(
  media: readonly ProductImageMedia[],
  colourId: string | null | undefined,
): ProductImageMedia[] {
  if (media.length === 0) return [];

  if (colourId) {
    const own = media.filter((image) => image.colourId === colourId);
    if (own.length > 0) return [...own];
  }

  const general = media.filter((image) => image.colourId === null);
  if (general.length > 0) return [...general];

  return [...media];
}

/**
 * The one photograph that represents a colour — the cart thumbnail, and what
 * the order line stores.
 *
 * Deliberately the first image of `mediaForColour`, so the picture in the bag
 * is the picture the customer was looking at when they pressed Add to Cart.
 */
export function primaryImageForColour(
  media: readonly ProductImageMedia[],
  colourId: string | null | undefined,
  fallbackUrl?: string,
): string {
  const group = mediaForColour(media, colourId);
  return group[0]?.url ?? fallbackUrl ?? "";
}

/**
 * The colour id for a selected colour NAME.
 *
 * The selection is a name because that is what the variant matrix is keyed on
 * and what the size/colour resolution in lib/product-variants.ts works with —
 * there is one source of truth for the selection, and this only translates it
 * into the id the images are stored against. Null when the product has no
 * colour axis, or when its variants carry no colour row yet (pre-0025 data),
 * which sends `mediaForColour` down its general-images fallback.
 */
export function colourIdForName(
  variants: readonly ProductVariant[],
  colourName: string,
): string | null {
  if (!colourName) return null;
  const match = variants.find((variant) => variant.colour?.name === colourName);
  return match?.colour?.id ?? null;
}

/** Colours that actually have photographs of their own. Used by the admin panel. */
export function colourIdsWithImages(media: readonly ProductImageMedia[]): Set<string> {
  const ids = new Set<string>();
  for (const image of media) {
    if (image.colourId) ids.add(image.colourId);
  }
  return ids;
}

/**
 * Does this product use colour-specific photography at all?
 *
 * False for every product that existed before this feature, which is what keeps
 * their galleries behaving exactly as they did.
 */
export function hasColourSpecificImages(media: readonly ProductImageMedia[]): boolean {
  return media.some((image) => image.colourId !== null);
}

/** A colour option's id, or null — one place to reach through the optional. */
export function colourOptionId(colour: ColourOption | null | undefined): string | null {
  return colour?.id ?? null;
}
