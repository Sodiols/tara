/**
 * Variant SKU suggestions.
 *
 * A SKU is unique across the whole store and is typed by hand today, which is
 * slow and produces inconsistent codes: TARA2401-M-WINE from one staff member
 * and tara 2401 m wine from the next. This builds the house style from values
 * already on screen — the product code, the size and the colour — as a
 * SUGGESTION only.
 *
 * It is never authoritative:
 *
 *   * the field stays editable, and the moment a staff member types in it the
 *     form stops overwriting what they wrote;
 *   * uniqueness is checked on the server, against the database, exactly as
 *     before. Two wine mediums in the same product code would collide here and
 *     be refused there, which is the correct place for it to fail.
 *
 * Nothing derived here can widen the character set the SKU schema accepts: the
 * result is filtered to [A-Z0-9-] and truncated to the 40 characters the column
 * and the Zod schema allow.
 */

const MAX_SKU_LENGTH = 40;

function segment(value: string, maxLength: number): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

/**
 * Builds `PRODUCTCODE-SIZE-COLOUR` from whatever of the three is filled in.
 *
 * Returns an empty string when there is not enough to build anything useful,
 * so the caller can leave the field alone rather than writing a stub the staff
 * member then has to clear.
 */
export function suggestVariantSku(
  productCode: string,
  size: string,
  colour: string,
): string {
  const code = segment(productCode, 20);
  if (!code) return "";

  const parts = [code, segment(size, 8), segment(colour, 12)].filter(Boolean);
  if (parts.length < 2) return "";

  return parts.join("-").slice(0, MAX_SKU_LENGTH).replace(/-+$/, "");
}
