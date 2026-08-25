/**
 * Safe serialisation for JSON-LD.
 *
 * A `<script type="application/ld+json">` block is read by the HTML tokeniser
 * before it is parsed as JSON, and the tokeniser ends the script at the first
 * `</script`. A product name, a category label, a review body or a store
 * address containing `</script>` would therefore close the block early and let
 * everything after it be parsed as markup — script injection through a field an
 * administrator can edit from /admin/products.
 *
 * JSON.stringify does not escape `<`, because it is a perfectly legal character
 * inside a JSON string. Rewriting it as a `<` escape produces a document
 * that parses to exactly the same value and cannot terminate the element. `>`
 * and `&` are escaped alongside it so the output is safe in any HTML context,
 * and U+2028 / U+2029 because they terminate a JavaScript string literal for
 * any consumer that evaluates the payload rather than parsing it.
 *
 * Never build a JSON-LD string any other way.
 */

// Built from a string rather than a regex literal so the two line-separator
// code points are named by escape and never appear raw in this file — a raw
// U+2028 is invisible in an editor and survives copy-paste badly.
const HTML_UNSAFE = new RegExp("[<>&\\u2028\\u2029]", "g");

function toUnicodeEscape(character: string): string {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/**
 * Serialises a structured-data object for embedding in a script element.
 *
 * `undefined` properties are dropped by JSON.stringify, which is what we want:
 * schema.org treats an absent property and a null one differently, and an
 * `aggregateRating: null` makes a Product listing invalid in Search Console.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(HTML_UNSAFE, toUnicodeEscape);
}

/**
 * The props for a JSON-LD script element.
 *
 * A helper rather than a component, so it can be spread onto a `<script>` in a
 * Server Component without introducing a client boundary:
 *
 *   <script {...jsonLdScriptProps(productSchema)} />
 */
export function jsonLdScriptProps(data: unknown) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: jsonLd(data) },
  };
}
