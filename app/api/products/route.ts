import { NextResponse, type NextRequest } from "next/server";
import {
  getProductVariants,
  getProductsBySlugs,
  searchProducts,
} from "@/lib/supabase/queries/products";
import { guardPublicAction, consumeDurableLimit } from "@/lib/rate-limit";

/**
 * Public catalogue lookup, used by the search overlay, the recently-viewed rail
 * and the product card's size and colour selectors.
 *
 * Everything it returns is already public, so the risk here is not disclosure
 * but load. Both branches are now a single database round trip: `slugs` used to
 * fan out to one getProductBySlug() per slug, each of which hydrated images,
 * variants, reviews, category and collection — so one request for twelve
 * thumbnails could become dozens of queries.
 */

/** Matches the shape produced by `slugify()`; anything else cannot be a slug. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return NextResponse.json(await searchProducts(query, 8), {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      },
    });
  }

  /*
   * The purchasable matrix for ONE product, asked for on demand.
   *
   * A listing deliberately does not carry variants: `search_catalogue()`
   * flattens them into distinct size and colour arrays, and attaching the real
   * matrix to all 24 rows of every listing would pay for a selector almost
   * nobody opens. But a product card that offers a size and a colour has to
   * know which pairs exist, or it offers combinations that do not — the exact
   * dead end lib/product-variants.ts was written to remove.
   *
   * So the card fetches this for the one product a customer actually engages
   * with. Same data the product page reads, same RLS: active variants of active
   * products only.
   *
   * Never cached. This is stock, and a card that offers the last one of a size
   * an hour after it sold is the thing the product page already refuses to do.
   */
  const variantsFor = request.nextUrl.searchParams.get("variantsFor")?.trim();
  if (variantsFor) {
    if (!UUID_PATTERN.test(variantsFor)) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }
    return NextResponse.json(await getProductVariants(variantsFor), {
      headers: { "Cache-Control": "no-store" },
    });
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
    return NextResponse.json(await getProductsBySlugs(slugs), {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  return NextResponse.json([]);
}
