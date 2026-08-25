import type { Metadata } from "next";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";

/**
 * Search results are not indexable.
 *
 * They are an infinite set of near-duplicate pages built from whatever visitors
 * type, which dilutes the index and earns nothing. robots.txt asks crawlers not
 * to fetch /search; this header is what stops a page that was reached some
 * other way from being indexed anyway.
 */
export const metadata: Metadata = {
  title: "Search Results",
  description: "Search results for products at TARA.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: ListingSearchParams;
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  // Search goes through the same listing pipeline as every category page, so it
  // gets real database pagination, the same filters and the same true result
  // count rather than a one-off "first 48 matches" query.
  return (
    <ProductListingSection
      title={query ? `Search: ${query}` : "Search"}
      searchParams={searchParams}
    />
  );
}
