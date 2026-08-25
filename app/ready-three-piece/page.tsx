import type { Metadata } from "next";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Ready Three Piece",
  description:
    "Shop ready-to-wear three piece sets from TARA — stitched, finished and sized, ready to wear straight away.",
  alternates: { canonical: `${siteConfig.url}/ready-three-piece` },
};

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
      title="Ready Three Piece"
      searchParams={searchParams}
      scope={{ category: "ready-three-piece" }}
    />
  );
}
