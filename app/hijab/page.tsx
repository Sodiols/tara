import type { Metadata } from "next";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Hijab",
  description:
    "Shop hijabs from TARA — everyday and occasion styles in soft, breathable fabrics, finished for comfortable all-day wear.",
  alternates: { canonical: `${siteConfig.url}/hijab` },
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
      title="Hijab"
      searchParams={searchParams}
      scope={{ category: "hijab" }}
    />
  );
}
