import { NextResponse, type NextRequest } from "next/server";
import { getProductBySlug, searchProducts } from "@/lib/supabase/queries/products";
import { guardPublicAction } from "@/lib/rate-limit";

/**
 * Public catalogue lookup, used by the search overlay, the wishlist and the
 * recently-viewed rail.
 *
 * Everything it returns is already public, so the risk here is not disclosure
 * but load: a `slugs` request fans out to one `getProductBySlug()` per slug,
 * and each of those hydrates images, variants, reviews, category and collection
 * — so a single unthrottled request could turn into dozens of database round
 * trips. The cap on slug count and the per-client rate limit together keep that
 * bounded.
 */

/** Matches the shape produced by `slugify()`; anything else cannot be a slug. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_SLUGS = 12;

export async function GET(request: NextRequest) {
  const { result } = await guardPublicAction("catalogue-api", 60, 60);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (query) {
    return NextResponse.json(await searchProducts(query, 8));
  }

  const slugs = request.nextUrl.searchParams
    .get("slugs")
    ?.split(",")
    .map((slug) => slug.trim().toLowerCase())
    // Rejecting malformed slugs up front means a request full of junk costs one
    // regex each rather than a database round trip each.
    .filter((slug) => SLUG_PATTERN.test(slug) && slug.length <= 120)
    .slice(0, MAX_SLUGS);

  if (slugs?.length) {
    const unique = [...new Set(slugs)];
    const products = await Promise.all(unique.map(getProductBySlug));
    return NextResponse.json(products.filter(Boolean));
  }

  return NextResponse.json([]);
}
