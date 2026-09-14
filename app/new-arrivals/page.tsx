import type { Metadata } from "next";
import { listingMetadata } from "@/lib/seo";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";

/**
 * The clean /new-arrivals is canonical and indexable; every filtered, sorted or
 * paginated variant points its canonical at it AND carries noindex, follow.
 *
 * This used to be a constant `metadata` export, which cannot see the query
 * string. The comment that sat here promised the canonical was the bare path —
 * true — but the variants were still indexable, and a canonical alone is a
 * suggestion. Every combination of size, colour, price band, sort and page
 * renders substantially the same products; left indexable they compete with
 * this page and spend the crawl budget on permutations. `follow` stays on so
 * the products those variants link to are still discovered.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: ListingSearchParams;
}): Promise<Metadata> {
  return listingMetadata({
    title: "New Arrivals",
    description:
      "The newest women's clothing at TARA — three piece, two piece, hijab and accessories, added as each batch arrives.",
    path: "/new-arrivals",
    searchParams: await searchParams,
  });
}

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return (
    <ProductListingSection
      title="New Arrivals"
      searchParams={searchParams}
      scope={{ isNew: true }}
    />
  );
}
