import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = buildMetadata({
  title: "New Arrivals",
  description:
    "The newest women's clothing at TARA — three piece, two piece, hijab and accessories, added as each batch arrives.",
  path: "/new-arrivals",
});

/**
 * The canonical URL is the bare path, without the filter query.
 *
 * Every combination of size, colour, price band, sort and page is a distinct
 * URL that renders substantially the same set of products. Left uncanonicalised
 * they compete with each other and with this page in the index, and the crawl
 * budget goes on permutations instead of products.
 */
export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return (
    <ProductListingSection
      title="New Arrivals"
      searchParams={searchParams}
      scope={{ isNew: true }}
    />
  );
}
