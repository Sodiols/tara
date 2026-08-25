import { NextResponse, type NextRequest } from "next/server";
import { getProductSlice } from "@/lib/supabase/queries/products";
import { productFiltersFromParams } from "@/lib/catalogue-filters";
import { guardPublicAction, consumeDurableLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * The next page of a catalogue listing, for the "Load More" button.
 *
 * Everything it returns is already public, so the risk is load rather than
 * disclosure: this is one database round trip per request, capped at the
 * listing page size, and throttled per client.
 *
 * The route's *scope* — which category or collection is being browsed — is read
 * from the query string like everything else, which is safe because it can only
 * ever narrow a public catalogue, never widen it beyond what an anonymous
 * visitor may already see. Row level security is the backstop: search_catalogue
 * returns active products only.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugParam(request: NextRequest, key: string): string | undefined {
  const value = request.nextUrl.searchParams.get(key)?.trim().toLowerCase();
  if (!value || value.length > 120 || !SLUG_PATTERN.test(value)) return undefined;
  return value;
}

export async function GET(request: NextRequest) {
  const { fingerprint, result } = await guardPublicAction("catalogue-api", 90, 60);
  if (!result.allowed || !(await consumeDurableLimit("catalogue-api", fingerprint))) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds || 60) } },
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = productFiltersFromParams(params);

  const page = filters.page ?? 1;
  const slice = await getProductSlice(
    {
      ...filters,
      category: slugParam(request, "category"),
      collection: slugParam(request, "collectionSlug"),
      featured: request.nextUrl.searchParams.get("featured") === "true",
      bestSeller: request.nextUrl.searchParams.get("bestSeller") === "true",
    },
    page,
  );

  logger.debug("catalogue.load_more", {
    page,
    returned: slice.products.length,
    total: slice.total,
  });

  return NextResponse.json(
    { products: slice.products, total: slice.total, page: slice.page, hasMore: slice.hasMore },
    // A listing page is the same for every visitor, so a short shared cache is
    // safe and takes the repeat-scroll traffic off the database. Nothing here
    // is user-specific.
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
  );
}
