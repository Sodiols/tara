import { NextResponse, type NextRequest } from "next/server";
import { getProductsBySlugs, searchProducts } from "@/lib/supabase/queries/products";
import { guardPublicAction, consumeDurableLimit } from "@/lib/rate-limit";

/**
 * Public catalogue lookup, used by the search overlay, the wishlist rail and
 * the recently-viewed rail.
 *
 * Everything it returns is already public, so the risk here is not disclosure
 * but load. Both branches are now a single database round trip: `slugs` used to
 * fan out to one getProductBySlug() per slug, each of which hydrated images,
 * variants, reviews, category and collection — so one request for twelve
 * thumbnails could become dozens of queries.
 */

/** Matches the shape produced by `slugify()`; anything else cannot be a slug. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_SLUGS = 12;

export async function GET(request: NextRequest) {
  const { fingerprint, result } = await guardPublicAction("catalogue-api", 60, 60);
  if (!result.allowed || !(await consumeDurableLimit("catalogue-api", fingerprint))) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds || 60) } },
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
    return NextResponse.json(await getProductsBySlugs(slugs));
  }

  return NextResponse.json([]);
}
