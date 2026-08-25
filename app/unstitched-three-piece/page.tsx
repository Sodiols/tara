import type { Metadata } from "next";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Unstitched Three Piece",
  description:
    "Shop premium unstitched three piece sets from TARA — lawn, cotton, and georgette fabrics with hand embroidery, ready to be tailored to your fit.",
  alternates: { canonical: `${siteConfig.url}/unstitched-three-piece` },
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
      title="Unstitched Three Piece"
      searchParams={searchParams}
      scope={{ category: "unstitched-three-piece" }}
    />
  );
}
