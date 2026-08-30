/**
 * Size values that are not really sizes.
 *
 * A three piece sold as fabric has no S/M/L — it has one variant whose `size`
 * is a placeholder. The storefront uses that to decide whether to render a size
 * selector at all, and the filter sidebar uses it to keep the placeholder out
 * of the Size facet.
 *
 * THE RENAMES
 * -----------
 * That placeholder has now been spelled three ways in this database:
 *
 *   "Undready"    a corrupted find-and-replace, repaired by migration 0007
 *   "Unstitched"  what 0007 restored it to
 *   "Unready"     the current wording
 *
 * Both older spellings still exist in two places that must keep working:
 * a shopper's saved cart in localStorage, and `order_items.size` on every order
 * already placed. Order snapshots are deliberately never rewritten — an invoice
 * has to keep saying what it said — so anything reading a size has to accept
 * all three and resolve to the current one.
 *
 * This module is the single place that knows that. Do not compare a size to a
 * string literal anywhere else.
 */

/** The current spelling. What new variants are created with. */
export const UNREADY_SIZE = "Unready";

/** The placeholder for a product sold in one size only. */
export const ONE_SIZE = "One Size";

/**
 * Every spelling the unready placeholder has had, oldest first.
 *
 * Kept so a cart saved before a rename, or an order placed before one, still
 * resolves to a real variant instead of failing checkout with "a selected
 * product option is no longer available".
 */
export const LEGACY_UNREADY_SIZES = ["Undready", "Unstitched"] as const;

/**
 * Resolves a stored or client-supplied size to its current spelling.
 *
 * Applied on the way into checkout so a cart saved months ago still matches a
 * live variant row. The database does the same thing inside
 * `resolve_cart_lines()`, because the browser is not the authority on which
 * variant is being bought.
 */
export function normaliseSizeValue(size: string): string {
  const trimmed = size.trim();
  return (LEGACY_UNREADY_SIZES as readonly string[]).includes(trimmed)
    ? UNREADY_SIZE
    : trimmed;
}

/**
 * True for a size that is a stand-in rather than a real measurement.
 *
 * Used to decide whether to show a size selector, and to keep placeholders out
 * of the Size filter — a facet listing "Unready" alongside S/M/L invites a
 * shopper to filter on something that is not a size.
 */
export function isPlaceholderSize(size: string): boolean {
  const normalised = normaliseSizeValue(size);
  return normalised === ONE_SIZE || normalised === UNREADY_SIZE;
}

/**
 * True when a product has sizes worth offering a selector for.
 *
 * Reads the first size because a product either has real sizes or a single
 * placeholder variant; it is never a mixture.
 */
export function hasSelectableSizes(sizes: readonly string[]): boolean {
  return sizes.length > 0 && !isPlaceholderSize(sizes[0]);
}

/**
 * The size to SHOW for a stored value.
 *
 * Identical to `normaliseSizeValue()`, named separately because the intent is
 * different and the distinction matters: this is for rendering, and its result
 * must never be written back.
 *
 * It exists because `order_items.size` is a snapshot. An order placed while the
 * placeholder was called "Unstitched" still says "Unstitched", and it always
 * will — rewriting delivered orders to match today's vocabulary would falsify a
 * record an invoice was issued from. But a staff member looking at that order in
 * the admin panel should still read the word the shop uses now.
 *
 * So the stored value stays honest and the label follows the current wording.
 */
export function formatSizeLabel(size: string | null | undefined): string {
  if (!size) return "";
  return normaliseSizeValue(size);
}

/**
 * Garment order for a set of sizes.
 *
 * The database returns sizes in whatever order the query produced, which is
 * alphabetical — so a product with S, M, L and XL was being advertised on its
 * card as "L M S XL". That is not a size run, it is four letters, and a
 * customer has to stop and re-read it to work out what is stocked.
 *
 * Named sizes sort by the order clothes are actually made in. Numeric sizes
 * (38, 40, 42) sort numerically and follow the named ones, because a catalogue
 * that mixes both is listing two different systems and the lettered run is the
 * one shoppers scan first. Anything unrecognised keeps a stable alphabetical
 * order at the end rather than being dropped — an unfamiliar size is still a
 * size someone can buy.
 *
 * Pure and total: it never throws, never drops an entry, and returns a new
 * array rather than sorting the caller's in place.
 */
const NAMED_SIZE_ORDER: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  "2XL": 6,
  XXXL: 7,
  "3XL": 7,
  "4XL": 8,
};

export function sortSizes(sizes: readonly string[]): string[] {
  const rank = (size: string): [number, number, string] => {
    const key = size.trim().toUpperCase();
    const named = NAMED_SIZE_ORDER[key];
    if (named !== undefined) return [0, named, key];
    const numeric = Number(key);
    if (Number.isFinite(numeric) && key !== "") return [1, numeric, key];
    return [2, 0, key];
  };

  return [...sizes].sort((a, b) => {
    const [groupA, orderA, keyA] = rank(a);
    const [groupB, orderB, keyB] = rank(b);
    if (groupA !== groupB) return groupA - groupB;
    if (orderA !== orderB) return orderA - orderB;
    return keyA.localeCompare(keyB);
  });
}
